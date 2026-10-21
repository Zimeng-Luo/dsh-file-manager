import { mkdir,readFile,writeFile,rename,rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Library,LibraryError,DEFAULTS } from './library.mjs';

/** Directory selection is host-wide, persisted independently of any Session. */
export class LibraryManager {
  #queue = Promise.resolve();
  #library = null;
  #closed = false;
  constructor(config) {
    this.config = config;
    this.settingsPath = path.join(config.stateDir, 'settings.json');
    this.initializationError = null;
    this.attemptedDirectory = config.directory;
    this.ready = this.#initialize().catch(error => { this.initializationError = error; });
  }
  async #initialize() {
    let saved;
    try { saved = JSON.parse(await readFile(this.settingsPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (saved && (saved.version !== 1 || typeof saved.directory !== 'string')) {
      throw new LibraryError('invalid-settings', 'Unsupported library settings; restore a valid settings.json.');
    }
    const directory = saved?.directory ?? this.config.directory;
    this.attemptedDirectory = directory;
    if (directory) {
      this.#library = await Library.open(directory, this.config);
      try { await this.#library.refresh(); }
      catch (error) { await this.#library.close(); this.#library = null; throw error; }
    }
  }
  #run(operation) {
    if (this.#closed) return Promise.reject(new LibraryError('closed', 'Library manager has been closed.'));
    const pending = this.#queue.then(() => this.ready).then(operation);
    this.#queue = pending.catch(() => {});
    return pending;
  }
  status() {
    return this.#run(() => ({
      configured: Boolean(this.#library),directory: this.#library?.root ?? this.attemptedDirectory ?? '',
      initializationError: this.initializationError ? { code:this.initializationError.code ?? 'initialization-failed',message:this.initializationError.message } : null,
      maxFileBytes: this.config.maxFileBytes ?? DEFAULTS.maxFileBytes,
      pollIntervalMs: this.config.pollIntervalMs ?? 5000,
    }));
  }
  configure(directory) {
    return this.#run(async () => {
      if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
        throw new LibraryError('invalid-directory', 'Choose an absolute directory on the Harness host.');
      }
      const next = await Library.open(directory, this.config);
      try {
        await next.refresh();
        await mkdir(path.dirname(this.settingsPath), { recursive: true });
        const temporary = this.settingsPath + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(temporary, JSON.stringify({ version: 1,directory: next.root }) + '\n', { flag: 'wx',mode: 0o600 });
          await rename(temporary, this.settingsPath);
        } finally { await rm(temporary, { force: true }); }
      } catch (error) { await next.close(); throw error; }
      const previous = this.#library;
      this.#library = next;
      this.initializationError = null;
      this.attemptedDirectory = next.root;
      await previous?.close();
      return { configured: true,directory: next.root };
    });
  }
  call(method, ...args) {
    return this.#run(async () => {
      if (this.initializationError) throw this.initializationError;
      if (!this.#library) throw new LibraryError('not-configured', 'Open the Library page and configure its directory first.');
      return this.#library[method](...args);
    });
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    await this.#queue;
    await this.ready;
    await this.#library?.close();
  }
}
