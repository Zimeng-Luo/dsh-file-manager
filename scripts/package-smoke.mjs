import assert from 'node:assert/strict';
import { mkdtemp,readdir,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const archive=(await readdir(process.cwd())).find(name => /^dsh-file-manager-.*\.tgz$/.test(name));
assert.ok(archive,'Run npm pack before the installed-package smoke.');
assert.ok(process.env.npm_execpath,'Run this script with npm run smoke:package.');
const temporary=await mkdtemp(path.join(tmpdir(),'dsh-library-package-'));
try {
  const install=spawnSync(process.execPath,[
    process.env.npm_execpath,'install','--ignore-scripts','--omit=dev','--no-audit','--no-fund',path.resolve(archive),
  ],{ cwd:temporary,encoding:'utf8',timeout:120000 });
  assert.equal(install.status,0,install.stderr);
  const root=path.join(temporary,'node_modules','dsh-file-manager');
  const entry=await import(pathToFileURL(path.join(root,'src','host.mjs')));
  assert.equal(typeof entry.apply,'function');
  assert.equal(entry.Config.parse({}).directory,'');
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(manifest.scripts.prepare,undefined);
  assert.equal(manifest.scripts.prepack,undefined);
  assert.equal((await readFile(path.join(root,'skills','library','SKILL.md'),'utf8')).includes('library_store'),true);
  assert.equal((await readFile(path.join(root,'client.js'),'utf8')).startsWith('window.__ModuleLoader__.load('),true);
  console.log('Installed package imports successfully with production dependencies only.');
} finally { await rm(temporary,{ recursive:true,force:true }); }
