import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('missing node:sqlite does not prevent host import or the setup page',async () => {
  const source = `
    import { registerHooks } from 'node:module';
    import assert from 'node:assert/strict';
    import { mkdtemp,rm } from 'node:fs/promises';
    import { tmpdir } from 'node:os';
    import path from 'node:path';
    registerHooks({ resolve(specifier,context,next) {
      if (specifier === 'node:sqlite') throw new Error('SQLite is disabled in this runtime');
      return next(specifier,context);
    } });
    await import('./src/host.mjs');
    const { LibraryManager } = await import('./src/manager.mjs');
    const base = await mkdtemp(path.join(tmpdir(),'library-no-sqlite-'));
    const manager = new LibraryManager({ stateDir:path.join(base,'state') });
    try {
      assert.equal((await manager.status()).configured,false);
      await assert.rejects(manager.configure(path.join(base,'library')),error => error.code === 'sqlite-unavailable');
    } finally { await manager.close(); await rm(base,{ recursive:true,force:true }); }
  `;
  const { stderr } = await promisify(execFile)(process.execPath,['--input-type=module','-e',source]);
  assert.doesNotMatch(stderr,/UnhandledPromiseRejection/);
});
