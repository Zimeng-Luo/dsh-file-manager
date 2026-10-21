import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('client consistency check accepts equivalent CRLF source and artifact checkouts',async () => {
  const directory=await mkdtemp(path.join(tmpdir(),'dsh-client-crlf-'));
  try {
    await mkdir(path.join(directory,'src'));
    await mkdir(path.join(directory,'scripts'));
    for (const relative of ['src/client-factory.cjs','client.js','scripts/build.cjs']) {
      const original=await readFile(new URL('../'+relative,import.meta.url),'utf8');
      await writeFile(path.join(directory,relative),original.replace(/\r?\n/g,'\r\n'));
    }
    const result=spawnSync(process.execPath,[path.join(directory,'scripts/build.cjs'),'--check'],{ encoding:'utf8' });
    assert.equal(result.status,0,result.stderr);
  } finally { await rm(directory,{ recursive:true,force:true }); }
});
