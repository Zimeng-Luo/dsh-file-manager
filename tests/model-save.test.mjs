import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import LocalFileSystem from '@deepseek-ai/dsh-fs-local';
import * as Host from '../src/host.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const base = await mkdtemp(path.join(tmpdir(),'library-model-save-'));
  const project = path.join(base,'project');
  await mkdir(project);
  const source = path.join(project,'原始 图片.png');
  await writeFile(source,png);
  const ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); await rm(base,{ recursive:true,force:true }); });
  await ctx.plugin(SystemPrompt,{});
  await ctx.plugin(Tools,{});
  await ctx.plugin(LocalFileSystem,{ cwd:project });
  ctx.provide('workingDirectory',{ get:session => session.cwd });
  await ctx.plugin(Host,{ directory:path.join(base,'library'),stateDir:path.join(base,'state') });
  await Promise.all([...ctx.registry.values()].flatMap(runtime => Array.from(runtime.fibers,fiber => fiber.await())));
  const a = { ctx,session:{ id:'session-a',cwd:project } };
  const b = { ctx,session:{ id:'session-b',cwd:path.join(base,'different-project') } };
  let call = 0;
  const invoke = (name,args,agent=a,signal=new AbortController().signal) => ctx.get('tools').execute({
    callId:'library-regression-' + (++call),name,arguments:args,agent,signal,
  });
  const run = async (name,args,agent=a) => {
    const result = await invoke(name,args,agent);
    assert.equal(result.isError,false,result.error?.message ?? JSON.stringify(result));
    return result.value;
  };
  return { base,ctx,source,a,b,invoke,run };
}

test('native model call copies an image with content empty and another session finds its original bytes',async t => {
  const { ctx,source,b,run } = await fixture(t);
  const saved = await run('library_store',{
    sourcePath:source,content:'',name:'',title:'原图保存回归',description:'pixelFixture original image',tags:['图片','pixelFixture'],
  });
  assert.equal(saved.name,path.basename(source));
  assert.equal(saved.sha256,sha256(png));
  assert.deepEqual(await readFile(saved.path),png);
  assert.deepEqual(await readFile(source),png);
  assert.equal(saved.indexStatus,'metadata-only');
  const hits = await run('library_search',{ query:'pixelFixture' },b);
  assert.equal(hits.matches[0].id,saved.id);
  const list = await run('library_list',{},b);
  assert.equal(list.total,1);
  const downloaded = await ctx.get('library').call('download',saved.id);
  assert.deepEqual(Buffer.from(downloaded.base64,'base64'),png);
});

test('model file saves tolerate whitespace or null content and empty optional names',async t => {
  const { source,run } = await fixture(t);
  for (const content of [' \n\t ',null]) {
    const saved = await run('library_store',{ sourcePath:source,content,name:null,title:null,description:null,tags:null });
    assert.equal(saved.sha256,sha256(png));
    assert.equal(saved.name,path.basename(source));
  }
});

test('blank source paths do not conflict with notes and note bytes remain exact',async t => {
  const { run } = await fixture(t);
  for (const sourcePath of ['', ' \n ',null]) {
    const saved = await run('library_store',{ sourcePath,content:'  正文原样保留\n',name:'note.md' });
    assert.equal(await readFile(saved.path,'utf8'),'  正文原样保留\n');
  }
  const empty = await run('library_store',{ sourcePath:'',content:'' });
  assert.equal((await readFile(empty.path)).length,0);
});

test('two meaningful inputs and missing sources fail without copying files',async t => {
  const { source,invoke,run } = await fixture(t);
  const conflict = await invoke('library_store',{ sourcePath:source,content:'real note content' });
  assert.equal(conflict.isError,true);
  assert.match(conflict.error.message,/exactly one/i);
  const missing = await invoke('library_store',{ sourcePath:' ',content:null });
  assert.equal(missing.isError,true);
  assert.match(missing.error.message,/sourcePath|content/);
  assert.equal((await run('library_list',{})).total,0);
});

test('relative paths and file URLs import the original image through the session filesystem',async t => {
  const { source,run } = await fixture(t);
  for (const sourcePath of [path.basename(source),pathToFileURL(source).href]) {
    const saved = await run('library_store',{ sourcePath,content:'' });
    assert.deepEqual(await readFile(saved.path),png);
  }
});

test('invalid input types and cancelled file saves produce no library entry',async t => {
  const { source,invoke,run } = await fixture(t);
  for (const args of [null,[],{ sourcePath:3,content:'note' },{ sourcePath:source,content:4 }]) {
    const result = await invoke('library_store',args);
    assert.equal(result.isError,true);
  }
  const controller = new AbortController();
  controller.abort();
  const cancelled = await invoke('library_store',{ sourcePath:source,content:'' },undefined,controller.signal);
  assert.equal(cancelled.isError,true);
  assert.equal((await run('library_list',{})).total,0);
});
