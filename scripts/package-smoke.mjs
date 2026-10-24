import assert from 'node:assert/strict';
import { mkdtemp,readdir,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { load } from 'js-yaml';
import { boot } from '@deepseek-ai/dsh-app-boot';
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import LocalFileSystem from '@deepseek-ai/dsh-fs-local';

const archive=(await readdir(process.cwd())).find(name => /^dsh-file-manager-.*\.tgz$/.test(name));
assert.ok(archive,'Run npm pack before the installed-package smoke.');
assert.ok(process.env.npm_execpath,'Run this script with npm run smoke:package.');
const temporary=await mkdtemp(path.join(tmpdir(),'dsh-library-package-'));
let ctx;
const previousHome=process.env.DSH_HOME;
process.env.DSH_HOME=path.join(temporary,'home');
try {
  const install=spawnSync(process.execPath,[
    process.env.npm_execpath,'install','--ignore-scripts','--omit=dev','--no-audit','--no-fund',path.resolve(archive),
  ],{ cwd:temporary,encoding:'utf8',timeout:120000 });
  assert.equal(install.status,0,install.stderr);
  const root=path.join(temporary,'node_modules','dsh-file-manager');
  const entry=await import(pathToFileURL(path.join(root,'src','host.mjs')));
  assert.equal(typeof entry.apply,'function');
  assert.equal(entry.Config.parse({}).directory,'');
  assert.equal(entry.Config.parse(undefined).maxFileBytes,32 * 1024 * 1024);
  const manifest=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  assert.equal(manifest.scripts.prepare,undefined);
  assert.equal(manifest.scripts.prepack,undefined);
  assert.equal((await readFile(path.join(root,'skills','library','SKILL.md'),'utf8')).includes('library_store'),true);
  assert.equal((await readFile(path.join(root,'client.js'),'utf8')).startsWith('window.__ModuleLoader__.load('),true);
  const patch=load(await readFile(path.join(root,manifest.dsh.bundle.patch),'utf8'));
  const rows=patch.flatMap(operation => operation.insert ?? []);
  assert.equal(rows.length,1);
  assert.equal(rows[0].name,manifest.name);
  // Load the packed file through Harness boot and the actual bundle row.
  // A file URL avoids requiring a global CLI installation in this temporary profile.
  rows[0].name=pathToFileURL(path.join(root,manifest.main)).href;
  const configuration=path.join(temporary,'cordis.yml');
  await writeFile(configuration,JSON.stringify(rows));
  ctx=await boot('library-installed-smoke',configuration,[],async host => {
    await host.plugin(SystemPrompt,{});
    await host.plugin(Tools,{});
    await host.plugin(LocalFileSystem,{ cwd:temporary });
    await host.plugin({ name:'installed-smoke-connection',apply(scope) {
      new HostConnectionService(scope,[],{ isAuthenticated:() => true });
    } });
  });
  assert.ok(ctx.get('library'),'The installed bundle must activate its host entry.');
  await Promise.all([...ctx.registry.values()].flatMap(runtime => Array.from(runtime.fibers,fiber => fiber.await())));
  const handler=ctx.get('connection').createSharedFetchHandler('/api');
  const rpc=async (method,payload={}) => {
    const response=await handler.fetch(new Request('http://localhost/api/dsh-file-manager',{
      method:'POST',headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ type:'client-request',rpcId:'installed-'+method,method:'dsh-file-manager',payload:{ method,payload } }),
    }),{ principal:{ kind:'owner' } });
    assert.equal(response.status,200,await response.clone().text());
    const result=(await response.json()).result;
    assert.equal(result.ok,true,JSON.stringify(result));
    return result.value;
  };
  assert.equal((await rpc('status')).configured,false);
  await rpc('configure',{ directory:path.join(temporary,'library') });
  await rpc('note',{ name:'installed.md',content:'Installed profile library retrieval',title:'Installed smoke' });
  assert.equal((await rpc('list')).total,1);
  assert.equal((await rpc('search',{ query:'retrieval' })).matches.length,1);
  const prompt=await ctx.get('systemPrompt').assemble();
  assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,6);
  assert.equal(prompt.sections.some(section => section.name === 'library:usage'),true);
  const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  const imageSource=path.join(temporary,'原始图片.png');
  await writeFile(imageSource,imageBytes);
  const stored=await ctx.get('tools').execute({
    callId:'packed-image-save',name:'library_store',
    arguments:{ sourcePath:imageSource,content:'',name:'',title:'Packed image',tags:['packedImage'] },
    signal:new AbortController().signal,
  });
  assert.equal(stored.isError,false,stored.error?.message);
  assert.deepEqual(await readFile(stored.value.path),imageBytes);
  assert.deepEqual(await readFile(imageSource),imageBytes);
  assert.equal(stored.value.name,'原始图片.png');
  assert.equal(stored.value.title,'Packed image');
  assert.deepEqual(stored.value.tags,['packedImage']);
  assert.equal(stored.value.indexStatus,'metadata-only');
  const imageHits=await rpc('search',{ query:'packedImage' });
  assert.equal(imageHits.matches[0].id,stored.value.id);
  assert.equal((await rpc('list')).total,2);
  console.log('Packed plugin boots through Harness; a real model tool call saves the original PNG with empty content, and RPC finds the stored image and metadata.');
} finally {
  await ctx?.fiber.dispose();
  if (previousHome === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME=previousHome;
  await rm(temporary,{ recursive:true,force:true });
}
