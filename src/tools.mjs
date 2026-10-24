import { fileURLToPath } from 'node:url';
import { LibraryError,validateMetadata } from './library.mjs';

const output = {
  schema: { type: 'object',additionalProperties: true },
  render: (_args,value) => [{ type: 'text',text: JSON.stringify(value) }],
};
const schema = (properties = {},required = []) => ({ type: 'object',additionalProperties: false,properties,required });
const text = description => ({ type: 'string',description });
const limit = maximum => ({ type: 'integer',minimum: 1,maximum });


/** Model providers may materialize unused optional fields as empty strings or null. */
function storeInput(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new LibraryError('invalid-store','library_store expects an object with sourcePath or content.');
  }
  const input = { ...args };
  for (const field of ['sourcePath','content','name','title','description','tags']) {
    if (input[field] === null) delete input[field];
  }
  for (const field of ['sourcePath','content','name']) {
    if (input[field] !== undefined && typeof input[field] !== 'string') {
      throw new LibraryError('invalid-store-field',field + ' must be a string or omitted.');
    }
  }
  if (typeof input.name === 'string' && !input.name.trim()) delete input.name;
  const hasPath = typeof input.sourcePath === 'string' && Boolean(input.sourcePath.trim());
  const hasText = typeof input.content === 'string' && Boolean(input.content.trim());
  if (hasPath && hasText) {
    throw new LibraryError('invalid-store','Supply exactly one nonempty source: sourcePath for a file OR content for a note. To copy a file, omit content or set content to "". Do not repeat the same conflicting call.');
  }
  if (hasPath) return { input,hasPath:true };
  if (typeof input.content === 'string') return { input,hasPath:false };
  throw new LibraryError('missing-store-source','Provide an existing file in sourcePath, or note text in content. Example file call: {"sourcePath":"path/to/image.png"}. Do not invent a file path.');
}

/** Native tools are shared across allowed sessions, including dsh-im sessions. */
export function createLibraryTools(manager,fs,workingDirectory,getServices) {
  return [
    {
      name: 'library_status',description: 'Check whether the persistent shared library is configured and where its host directory is.',
      parameters: schema(),output,execute: () => manager.status(),
    },
    {
      name: 'library_store',
      description: 'Copy an existing file into the shared library, or save a text note. Use a nonempty sourcePath for files (omit content or leave it empty); use content for notes (leave sourcePath empty). Never send both a file path and real note text. Use for requests to save to the library; other conversations can then search it. A path belongs in sourcePath, not content.',
      parameters: schema({
        sourcePath: text('Existing file in the current filesystem provider, including images. Relative paths use this Session working directory. Local file:// URLs are accepted. Leave blank for text notes.'),
        content: text('UTF-8 note text. Omit or leave blank when copying a file; do not put an image description here instead of copying its original file.'),
        name: text('Filename without directories. Optional for source files; default note.md for text.'),
        title: text('Display title.'),description: text('Description to aid future searches.'),
        tags: { type: 'array',maxItems: 30,items: { type: 'string',maxLength: 100 } },
      }),
      output,
      async execute(rawArgs,exec) {
        const { input:args,hasPath } = storeInput(rawArgs);
        exec.signal?.throwIfAborted();
        validateMetadata(args);
        const status = await manager.status();
        if (!status.configured) throw new LibraryError('not-configured', 'Configure the library directory in the Library page first.');
        let bytes,name,source;
        if (hasPath) {
          let sourcePath = args.sourcePath;
          if (/^file:\/\//i.test(sourcePath)) {
            try { sourcePath = fileURLToPath(sourcePath); }
            catch { throw new LibraryError('invalid-source','sourcePath contains an invalid local file URL. Supply the original filesystem path.'); }
          }
          const services = getServices ? getServices(exec) : { fs,workingDirectory };
          if (!services.fs) throw new LibraryError('filesystem-unavailable','This agent has no filesystem provider. Upload the file in the Library page, or enable a filesystem provider for this agent.');
          const cwd = exec.agent ? services.workingDirectory?.get(exec.agent.session) : undefined;
          const target = await services.fs.resolve(sourcePath, { cwd,signal: exec.signal });
          bytes = await services.fs.readBytes(target, exec.signal, status.maxFileBytes);
          name = args.name ?? sourcePath.replace(/\\/g,'/').split('/').pop();
          source = args.sourcePath;
        } else {
          if (Buffer.byteLength(args.content,'utf8') > status.maxFileBytes) throw new LibraryError('file-too-large', 'Note exceeds maxFileBytes.');
          bytes = Buffer.from(args.content,'utf8'); name = args.name ?? 'note.md'; source = 'note';
        }
        exec.signal?.throwIfAborted();
        return manager.call('store', { bytes,name,title: args.title,description: args.description,tags: args.tags,source });
      },
    },
    {
      name: 'library_list',description: 'List shared library files and notes independently of this Session workspace. Follow nextOffset.',
      parameters: schema({ offset: { type: 'integer',minimum: 0 },limit: limit(100) }),
      output,execute: args => manager.call('list',args),
    },
    {
      name: 'library_search',description: 'Search shared library filenames, titles, descriptions, tags and indexed text. Use to find material saved in other conversations. Excerpts do not prove the whole document was read.',
      parameters: schema({ query: text('Chinese or English keywords.'),limit: limit(30) },['query']),
      output,execute: args => manager.call('search',args.query,args.limit),
    },
    {
      name: 'library_read',description: 'Read extracted text using the id from library_search/list/store. Follow nextOffset. Metadata-only files have no extracted text; use the returned path with an appropriate file tool.',
      parameters: schema({ id: text('Library item ID.'),offset: { type: 'integer',minimum: 0 },limit: limit(20000) },['id']),
      output,execute: ({ id,...options }) => manager.call('read',id,options),
    },
    {
      name: 'library_refresh',description: 'Discover manually copied files and update changed or removed entries in the configured library directory.',
      parameters: schema(),output,execute: () => manager.call('refresh'),
    },
  ];
}
