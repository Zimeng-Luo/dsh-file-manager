import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, readdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { extractDocument, tokenize } from './extract.mjs';

export const DEFAULTS = Object.freeze({
  maxFileBytes: 32 * 1024 * 1024, maxTextChars: 1_000_000,
  chunkChars: 2400, maxScanFiles: 20000,
});

export class LibraryError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function fail(code, message) { throw new LibraryError(code, message); }
export function itemKind(name,source) {
  const extension = path.extname(name).toLowerCase();
  if (['.png','.jpg','.jpeg','.gif','.webp','.avif','.bmp','.tif','.tiff'].includes(extension)) return 'image';
  if (source === 'note') return 'note';
  if (extension === '.pdf') return 'pdf';
  if (['.doc','.docx','.odt','.rtf'].includes(extension)) return 'document';
  if (['.xls','.xlsx','.csv','.ods'].includes(extension)) return 'spreadsheet';
  if (['.ppt','.pptx','.odp'].includes(extension)) return 'presentation';
  return 'file';
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/** Reject traversal and filenames with special Windows path semantics. */
export function safeName(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 180 || Buffer.byteLength(name) > 240
    || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name)
    || name === '.' || name === '..'
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) {
    fail('invalid-name', 'Use a filename without directories, reserved names or special path characters.');
  }
  return name;
}

export function validateMetadata(input) {
  for (const field of ['title', 'description']) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || input[field].length > 4000)) {
      fail('invalid-metadata', field + ' must be a string of at most 4000 characters.');
    }
  }
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 30
    || input.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 100))) {
    fail('invalid-metadata', 'tags must contain at most 30 nonempty strings of at most 100 characters.');
  }
}

function publicItem(row, root) {
  return {
    id: row.id, name: row.name, title: row.title, description: row.description,
    tags: JSON.parse(row.tags), path: path.join(root, row.relative_path),
    relativePath: row.relative_path, source: row.source, bytes: row.size, sha256: row.sha256,
    createdAt: row.created_at, updatedAt: row.updated_at, indexStatus: row.status,
    indexError: row.error, textTruncated: Boolean(row.truncated),
    kind: itemKind(row.name,row.source),folderId: row.folder_id ?? '',favorite: Boolean(row.favorite),
  };
}

/** Shared host storage; serialized operations keep file copies and SQLite updates ordered. */
export class Library {
  #queue = Promise.resolve();
  #closed = false;
  constructor(root, db, options) { this.root = root; this.db = db; this.options = options; }

  static async open(directory, options = {}) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('invalid-directory', 'The library directory must be an absolute host path.');
    const config = { ...DEFAULTS, ...options };
    for (const field of Object.keys(DEFAULTS)) {
      if (!Number.isSafeInteger(config[field]) || config[field] < 1) fail('invalid-config', field + ' must be a positive integer.');
    }
    let DatabaseSync;
    try { ({ DatabaseSync } = await import('node:sqlite')); }
    catch (error) {
      throw new LibraryError('sqlite-unavailable','The Harness host cannot load node:sqlite (Node ' + process.versions.node + '). Run Harness with a Node.js 22.19+ runtime that includes SQLite. ' + error.message);
    }
    await mkdir(directory, { recursive: true });
    const root = await realpath(directory);
    const internal = path.join(root, '.dsh-library');
    for (const target of [internal, ...['index.sqlite','index.sqlite-wal','index.sqlite-shm'].map(name => path.join(internal, name))]) {
      try { if ((await lstat(target)).isSymbolicLink()) fail('unsafe-path', 'Library index cannot use links or junctions.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await mkdir(internal, { recursive: true });
    const db = new DatabaseSync(path.join(internal, 'index.sqlite'));
    try {
      db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 0 && version !== 1) fail('unsupported-index', 'Unsupported library index version.');
      db.exec(
        'CREATE TABLE IF NOT EXISTS items (' +
        'id TEXT PRIMARY KEY,relative_path TEXT UNIQUE NOT NULL,name TEXT NOT NULL,title TEXT NOT NULL,' +
        'description TEXT NOT NULL,tags TEXT NOT NULL,source TEXT NOT NULL,size INTEGER NOT NULL,' +
        'mtime TEXT NOT NULL,sha256 TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL,' +
        'truncated INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);' +
        'CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(item_id UNINDEXED,start UNINDEXED,end UNINDEXED,meta,body);' +
        'PRAGMA user_version=1;'
      );
      // Additive tables preserve the original v1 item schema and copied file paths.
      db.exec("CREATE TABLE IF NOT EXISTS library_folders (id TEXT PRIMARY KEY,name TEXT NOT NULL,parent_id TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,UNIQUE(parent_id,name COLLATE NOCASE));" +
        "CREATE TABLE IF NOT EXISTS library_item_meta (item_id TEXT PRIMARY KEY,folder_id TEXT NOT NULL DEFAULT '',favorite INTEGER NOT NULL DEFAULT 0,modified_at TEXT NOT NULL);" +
        "CREATE INDEX IF NOT EXISTS library_meta_folder ON library_item_meta(folder_id);");
      return new Library(root, db, config);
    } catch (error) { db.close(); throw error; }
  }

  #run(operation) {
    if (this.#closed) return Promise.reject(new LibraryError('closed', 'Library has been closed.'));
    const pending = this.#queue.then(operation);
    this.#queue = pending.catch(() => {}); // One failed request must not poison subsequent requests.
    return pending;
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    await this.#queue;
    this.db.close();
  }

  #public(row) {
    const meta = this.db.prepare('SELECT folder_id,favorite FROM library_item_meta WHERE item_id=?').get(row.id);
    return publicItem({ ...row,...meta },this.root);
  }
  #folder(id) {
    if (typeof id !== 'string') fail('invalid-folder','Use a folder id, or an empty string for unfiled items.');
    if (id && !this.db.prepare('SELECT id FROM library_folders WHERE id=?').get(id)) fail('folder-not-found','Library folder not found.');
    return id;
  }

  async #target(relative) {
    const target = path.resolve(this.root, relative);
    if (!inside(this.root, target) || target === this.root
      || path.relative(this.root, target).split(path.sep)[0].toLowerCase() === '.dsh-library') {
      fail('unsafe-path', 'The requested file is outside the library.');
    }
    let cursor = this.root;
    for (const part of path.relative(this.root, target).split(path.sep)) {
      cursor = path.join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) fail('unsafe-path', 'Library files cannot use links or junctions.');
    }
    const canonical = await realpath(target);
    if (!inside(this.root, canonical)) fail('unsafe-path', 'The file resolves outside the library.');
    return canonical;
  }

  async #bytes(relative) {
    const target = await this.#target(relative);
    const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile()) fail('not-file', 'Expected a regular file.');
      if (before.size > BigInt(this.options.maxFileBytes)) fail('file-too-large', 'File exceeds maxFileBytes.');
      const buffer = Buffer.alloc(Number(before.size) + 1);
      let size = 0;
      while (size < buffer.length) {
        const result = await handle.read(buffer, size, buffer.length - size, size);
        if (!result.bytesRead) break;
        size += result.bytesRead;
      }
      const after = await handle.stat({ bigint: true });
      if (size !== Number(before.size) || before.mtimeNs !== after.mtimeNs || before.size !== after.size) {
        fail('file-changed', 'The file changed while being read; retry.');
      }
      return { bytes: buffer.subarray(0, size), stat: after };
    } finally { await handle.close(); }
  }

  #replace(row) {
    const meta = tokenize([row.name,row.title,row.description,...JSON.parse(row.tags)].join(' ')).join(' ');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM chunks WHERE item_id=?').run(row.id);
      this.db.prepare('INSERT OR REPLACE INTO items VALUES (' + Array(16).fill('?').join(',') + ')').run(
        ...['id','relative_path','name','title','description','tags','source','size','mtime','sha256','text','status','error','truncated','created_at','updated_at'].map(field => row[field])
      );
      const count = Math.max(1, Math.ceil(row.text.length / this.options.chunkChars));
      const insert = this.db.prepare('INSERT INTO chunks VALUES (?,?,?,?,?)');
      for (let i = 0; i < count; i++) {
        const start = i * this.options.chunkChars;
        const end = Math.min(start + this.options.chunkChars, row.text.length);
        insert.run(row.id, start, end, meta, tokenize(row.text.slice(start, end)).join(' '));
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  async #index(relative, metadata = {}, existing = null) {
    const target = await this.#target(relative);
    const observed = await lstat(target, { bigint: true });
    if (!observed.isFile()) fail('not-file', 'Expected a regular file.');
    if (existing && existing.mtime === String(observed.mtimeNs) && existing.size === Number(observed.size)) return existing;
    let extracted = { text: '', status: 'metadata-only', truncated: false };
    let sha = '', parseError = '', stat = observed;
    if (observed.size <= BigInt(this.options.maxFileBytes)) {
      const result = await this.#bytes(relative);
      stat = result.stat; sha = digest(result.bytes);
      try { extracted = await extractDocument(result.bytes, path.basename(relative), this.options.maxTextChars); }
      catch (error) { extracted.status = 'error'; parseError = String(error.message).slice(0,1000); }
    } else extracted.status = 'too-large';
    const now = new Date().toISOString();
    const row = {
      id: existing?.id ?? metadata.id ?? randomUUID(), relative_path: relative,
      name: path.basename(relative), title: existing?.title ?? metadata.title ?? path.basename(relative),
      description: existing?.description ?? metadata.description ?? '', tags: existing?.tags ?? JSON.stringify(metadata.tags ?? []),
      source: existing?.source ?? metadata.source ?? 'filesystem', size: Number(stat.size), mtime: String(stat.mtimeNs),
      sha256: sha, text: extracted.text, status: extracted.status, error: parseError,
      truncated: Number(extracted.truncated), created_at: existing?.created_at ?? now, updated_at: now,
    };
    this.#replace(row);
    return row;
  }

  async store({ bytes, name, title, description, tags, folderId = '',favorite = false, source = 'upload' }) {
    safeName(name); validateMetadata({ title, description, tags });
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > this.options.maxFileBytes) fail('file-too-large', 'File exceeds maxFileBytes.');
    return this.#run(async () => {
      this.#folder(folderId);
      if (typeof favorite !== 'boolean') fail('invalid-favorite','favorite must be a boolean.');
      const id = randomUUID(), parent = path.join(this.root, 'files');
      try { if ((await lstat(parent)).isSymbolicLink()) fail('unsafe-path', 'Files directory cannot be a link.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await mkdir(parent, { recursive: true });
      if (!inside(this.root, await realpath(parent))) fail('unsafe-path', 'Files directory resolves outside library.');
      const folder = path.join(parent, id);
      await mkdir(folder);
      const relative = path.relative(this.root, path.join(folder, name));
      const handle = await open(path.join(folder, name), 'wx');
      try { await handle.writeFile(bytes); await handle.sync(); }
      finally { await handle.close(); }
      // A database failure retains the copied original; a later refresh can recover it.
      const row = await this.#index(relative, { id,title,description,tags,source });
      this.db.prepare('INSERT INTO library_item_meta VALUES (?,?,?,?)').run(id,folderId,Number(favorite),new Date().toISOString());
      return this.#public(row);
    });
  }

  refresh() {
    return this.#run(async () => {
      const report = { scanned: 0,indexed: 0,removed: 0,errorCount: 0,errors: [],capped: false };
      const recordError = (relative, error) => {
        report.errorCount++;
        if (report.errors.length < 20) report.errors.push({ path: relative,error: error.message });
      };
      const walk = async relative => {
        let entries;
        try { entries = await readdir(path.join(this.root, relative), { withFileTypes: true }); }
        catch (error) { recordError(relative, error); return; }
        for (const entry of entries) {
          if (entry.name.toLowerCase() === '.dsh-library' || entry.isSymbolicLink()) continue;
          if (report.scanned >= this.options.maxScanFiles) { report.capped = true; return; }
          const candidate = path.join(relative, entry.name);
          try {
            await this.#target(candidate);
            if (entry.isDirectory()) await walk(candidate);
            else if (entry.isFile()) {
              report.scanned++;
              const previous = this.db.prepare('SELECT * FROM items WHERE relative_path=?').get(candidate);
              const row = await this.#index(candidate, {}, previous);
              if (!previous || row.updated_at !== previous.updated_at) report.indexed++;
            }
          } catch (error) { recordError(candidate, error); }
        }
      };
      await walk('');
      for (const row of this.db.prepare('SELECT id,relative_path FROM items').all()) {
        try { await this.#target(row.relative_path); }
        catch (error) {
          if (error.code === 'ENOENT') {
            this.db.exec('BEGIN IMMEDIATE');
            try {
              this.db.prepare('DELETE FROM chunks WHERE item_id=?').run(row.id);
              this.db.prepare('DELETE FROM items WHERE id=?').run(row.id);
              this.db.prepare('DELETE FROM library_item_meta WHERE item_id=?').run(row.id);
              this.db.exec('COMMIT'); report.removed++;
            } catch (error) { this.db.exec('ROLLBACK'); throw error; }
          } else recordError(row.relative_path, error);
        }
      }
      return report;
    });
  }

  list({ offset = 0,limit = 50 } = {}) {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      fail('invalid-page', 'offset must be nonnegative; limit must be 1..100.');
    }
    return this.#run(() => {
      const total = this.db.prepare('SELECT count(*) AS count FROM items').get().count;
      const rows = this.db.prepare('SELECT * FROM items ORDER BY created_at DESC,id LIMIT ? OFFSET ?').all(limit, offset);
      return { items: rows.map(row => this.#public(row)),total,nextOffset: offset + rows.length < total ? offset + rows.length : null };
    });
  }

  search(query, limit = 10) {
    if (typeof query !== 'string' || !query.trim() || query.length > 2000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 30) {
      fail('invalid-query', 'Supply a query and limit in 1..30.');
    }
    return this.#run(async () => {
      const words = [...new Set(tokenize(query))].slice(0,64);
      if (!words.length) return { matches: [],staleCandidates: 0 };
      const expression = words.map(word => '"' + word + '"').join(' OR ');
      const chunks = this.db.prepare(
        'WITH hits AS MATERIALIZED (SELECT item_id,start,end,bm25(chunks,0,0,0,8,1) AS score FROM chunks WHERE chunks MATCH ?) ' +
        'SELECT item_id,start,end FROM (SELECT *,row_number() OVER (PARTITION BY item_id ORDER BY score,start) AS position FROM hits) ' +
        'WHERE position=1 ORDER BY score,item_id LIMIT ?'
      ).all(expression, limit * 3);
      const matches = []; let staleCandidates = 0;
      for (const chunk of chunks) {
        const row = this.db.prepare('SELECT * FROM items WHERE id=?').get(chunk.item_id);
        let stat;
        try { stat = await lstat(await this.#target(row.relative_path), { bigint: true }); }
        catch { staleCandidates++; continue; }
        if (row.mtime !== String(stat.mtimeNs) || row.size !== Number(stat.size)) {
          await this.#index(row.relative_path, {}, row); staleCandidates++; continue;
        }
        matches.push({ ...this.#public(row),start: Number(chunk.start),end: Number(chunk.end),excerpt: row.text.slice(Number(chunk.start), Number(chunk.end)) });
        if (matches.length >= limit) break;
      }
      return { matches,staleCandidates,hint: staleCandidates ? 'Some entries changed or are unavailable. Refresh and search again.' : '' };
    });
  }

  read(id, { offset = 0,limit = 12000 } = {}) {
    if (typeof id !== 'string' || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20000) {
      fail('invalid-read', 'Use an item id, nonnegative offset and limit in 1..20000.');
    }
    return this.#run(async () => {
      let row = this.db.prepare('SELECT * FROM items WHERE id=?').get(id);
      if (!row) fail('not-found', 'Library entry not found.');
      row = await this.#index(row.relative_path, {}, row);
      return { ...this.#public(row),text: row.text.slice(offset, offset + limit),offset,totalChars: row.text.length,
        nextOffset: offset + limit < row.text.length ? offset + limit : null };
    });
  }

  /** Paged gallery queries apply every filter before LIMIT, including FTS matches. */
  browse({ query = '',offset = 0,limit = 60,folderId,kind = 'all',favorite,sort = 'recent' } = {}) {
    if (typeof query !== 'string' || query.length > 2000) fail('invalid-query','Query must be at most 2000 characters.');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('invalid-page','Use a nonnegative offset and limit 1..100.');
    const orders = { recent:'i.created_at DESC,i.id',oldest:'i.created_at ASC,i.id',name:'i.title COLLATE NOCASE,i.id',size:'i.size DESC,i.id',recommended:'coalesce(m.favorite,0) DESC,i.created_at DESC,i.id' };
    if (!Object.hasOwn(orders,sort) || !['all','images','documents','notes'].includes(kind)) fail('invalid-filter','Unknown sort or item type.');
    if (favorite !== undefined && typeof favorite !== 'boolean') fail('invalid-filter','favorite must be a boolean.');
    return this.#run(() => {
      const where = [],args = [];
      if (folderId !== undefined) { this.#folder(folderId); where.push("coalesce(m.folder_id,'')=?"); args.push(folderId); }
      if (favorite !== undefined) { where.push('coalesce(m.favorite,0)=?'); args.push(Number(favorite)); }
      const image = ['png','jpg','jpeg','gif','webp','avif','bmp','tif','tiff'].map(ext => "lower(i.name) LIKE '%." + ext + "'").join(' OR ');
      if (kind === 'images') where.push('(' + image + ')');
      if (kind === 'notes') where.push("i.source='note'");
      if (kind === 'documents') where.push('NOT (' + image + ") AND i.source!='note'");
      if (query.trim()) {
        const words = [...new Set(tokenize(query))].slice(0,64);
        if (!words.length) where.push('0');
        else { where.push('i.id IN (SELECT item_id FROM chunks WHERE chunks MATCH ?)'); args.push(words.map(word => '"' + word + '"').join(' OR ')); }
      }
      const from = ' FROM items i LEFT JOIN library_item_meta m ON m.item_id=i.id' + (where.length ? ' WHERE ' + where.join(' AND ') : '');
      const total = this.db.prepare('SELECT count(*) AS n' + from).get(...args).n;
      const rows = this.db.prepare("SELECT i.*,coalesce(m.folder_id,'') AS folder_id,coalesce(m.favorite,0) AS favorite" + from + ' ORDER BY ' + orders[sort] + ' LIMIT ? OFFSET ?').all(...args,limit,offset);
      return { items:rows.map(row => publicItem(row,this.root)),total,nextOffset:offset + rows.length < total ? offset + rows.length : null };
    });
  }

  folders() {
    return this.#run(() => ({
      folders:this.db.prepare('SELECT * FROM library_folders ORDER BY name COLLATE NOCASE,id').all().map(folder => {
        const count = this.db.prepare('SELECT count(*) AS n FROM library_item_meta m JOIN items i ON i.id=m.item_id WHERE m.folder_id=?').get(folder.id).n;
        const imageFilter = ['png','jpg','jpeg','gif','webp','avif','bmp','tif','tiff'].map(ext => "lower(i.name) LIKE '%." + ext + "'").join(' OR ');
        const covers = this.db.prepare('SELECT i.* FROM items i JOIN library_item_meta m ON m.item_id=i.id WHERE m.folder_id=? AND (' + imageFilter + ') ORDER BY i.created_at DESC,i.id LIMIT 3').all(folder.id).map(row => this.#public(row));
        return { id:folder.id,name:folder.name,parentId:folder.parent_id,createdAt:folder.created_at,count,covers };
      }),
    }));
  }

  createFolder({ name,parentId = '' }) {
    safeName(name);
    return this.#run(() => {
      this.#folder(parentId);
      if (this.db.prepare('SELECT count(*) AS n FROM library_folders').get().n >= 1000) fail('folder-limit','At most 1000 library folders are supported.');
      if (this.db.prepare('SELECT id FROM library_folders WHERE parent_id=? AND name=? COLLATE NOCASE').get(parentId,name)) fail('folder-exists','A folder with that name already exists here.');
      const id = randomUUID(),createdAt = new Date().toISOString();
      this.db.prepare('INSERT INTO library_folders VALUES (?,?,?,?)').run(id,name,parentId,createdAt);
      return { id,name,parentId,createdAt,count:0,covers:[] };
    });
  }

  renameFolder({ id,name }) {
    safeName(name);
    return this.#run(() => {
      if (!id) fail('invalid-folder','Select a folder to rename.');
      this.#folder(id);
      const folder = this.db.prepare('SELECT * FROM library_folders WHERE id=?').get(id);
      if (this.db.prepare('SELECT id FROM library_folders WHERE parent_id=? AND name=? COLLATE NOCASE AND id!=?').get(folder.parent_id,name,id)) fail('folder-exists','A folder with that name already exists here.');
      this.db.prepare('UPDATE library_folders SET name=? WHERE id=?').run(name,id);
      return { id,name,parentId:folder.parent_id };
    });
  }

  removeFolder({ id }) {
    return this.#run(() => {
      if (!id) fail('invalid-folder','Select a folder to remove.');
      this.#folder(id);
      const folder = this.db.prepare('SELECT * FROM library_folders WHERE id=?').get(id);
      const conflict = this.db.prepare('SELECT a.id FROM library_folders a JOIN library_folders b ON a.name=b.name COLLATE NOCASE WHERE a.parent_id=? AND b.parent_id=? AND b.id!=? LIMIT 1').get(id,folder.parent_id,id);
      if (conflict) fail('folder-conflict','Rename conflicting child folders before removing their parent.');
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare('UPDATE library_item_meta SET folder_id=? WHERE folder_id=?').run(folder.parent_id,id);
        this.db.prepare('UPDATE library_folders SET parent_id=? WHERE parent_id=?').run(folder.parent_id,id);
        this.db.prepare('DELETE FROM library_folders WHERE id=?').run(id);
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
      return { id,parentId:folder.parent_id,filesPreserved:true };
    });
  }

  update({ id,title,description,tags,folderId,favorite }) {
    validateMetadata({ title,description,tags });
    if (typeof id !== 'string' || !id) fail('invalid-id','Use a library item id.');
    if (favorite !== undefined && typeof favorite !== 'boolean') fail('invalid-favorite','favorite must be a boolean.');
    return this.#run(() => {
      const row = this.db.prepare('SELECT * FROM items WHERE id=?').get(id);
      if (!row) fail('not-found','Library entry not found.');
      if (folderId !== undefined) this.#folder(folderId);
      const prior = this.db.prepare('SELECT * FROM library_item_meta WHERE item_id=?').get(id);
      if (title !== undefined) row.title = title;
      if (description !== undefined) row.description = description;
      if (tags !== undefined) row.tags = JSON.stringify(tags);
      row.updated_at = new Date().toISOString();
      this.#replace(row);
      this.db.prepare('INSERT OR REPLACE INTO library_item_meta VALUES (?,?,?,?)').run(id,folderId ?? prior?.folder_id ?? '',Number(favorite ?? Boolean(prior?.favorite)),row.updated_at);
      return this.#public(row);
    });
  }

  asset(id) {
    if (typeof id !== 'string' || !id) fail('invalid-id','Use a library item id.');
    return this.#run(async () => {
      const row = this.db.prepare('SELECT * FROM items WHERE id=?').get(id);
      if (!row) fail('not-found','Library entry not found.');
      const { bytes } = await this.#bytes(row.relative_path);
      return { bytes,name:row.name,sha256:digest(bytes),kind:itemKind(row.name,row.source) };
    });
  }

  download(id) {
    if (typeof id !== 'string') fail('invalid-id', 'Use a library item id.');
    return this.#run(async () => {
      const row = this.db.prepare('SELECT * FROM items WHERE id=?').get(id);
      if (!row) fail('not-found', 'Library entry not found.');
      const { bytes } = await this.#bytes(row.relative_path);
      return { name: row.name,base64: bytes.toString('base64'),bytes: bytes.length };
    });
  }
}
