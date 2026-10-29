import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection';
import * as Host from '../src/host.mjs';

test('real Cordis loader and Harness Connection serve the Library RPC',async () => {
  const base = await mkdtemp(path.join(tmpdir(),'library-runtime-'));
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt,{});
    await ctx.plugin(Tools,{});
    await ctx.plugin({ name:'library-runtime-services',apply(ctx) {
      ctx.provide('fs',{});
      ctx.provide('workingDirectory',{});
      new HostConnectionService(ctx,[],{ isAuthenticated:() => true });
    } });
    await ctx.plugin(Host,{ stateDir:path.join(base,'state') });
    const handler = ctx.get('connection').createSharedFetchHandler('/api');
    const response = await handler.fetch(new Request('http://localhost/api/dsh-file-manager',{
      method:'POST',headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ type:'client-request',rpcId:'runtime-test',method:'dsh-file-manager',payload:{ method:'status',payload:{} } }),
    }),{ principal:{ kind:'owner' } });
    assert.equal(response.status,200,await response.clone().text());
    const envelope = await response.json();
    assert.equal(envelope.result.ok,true);
    assert.equal(envelope.result.value.configured,false);
    await Promise.all([...ctx.registry.values()].flatMap(runtime => Array.from(runtime.fibers,fiber => fiber.await())));
    const prompt = await ctx.get('systemPrompt').assemble();
    assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,8);
    assert.equal(prompt.sections.some(section => section.name === 'library:usage'),true);
  } finally {
    await ctx.fiber.dispose();
    await rm(base,{ recursive:true,force:true });
  }
});

async function runtimeFixture(t,options = {}) {
  const base = await mkdtemp(path.join(tmpdir(),'library-runtime-late-'));
  const ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); await rm(base,{ recursive:true,force:true }); });
  await ctx.plugin({ name:'library-runtime-connection',apply(ctx) {
    new HostConnectionService(ctx,[],{ isAuthenticated:() => true });
  } });
  if (options.agentServices) {
    await ctx.plugin(SystemPrompt,{});
    await ctx.plugin(Tools,{});
  }
  const directory = options.brokenDirectory ? path.join(base,'not-a-directory') : '';
  if (directory) await writeFile(directory,'file');
  await ctx.plugin(Host,{ directory,stateDir:path.join(base,'state') });
  const handler = ctx.get('connection').createSharedFetchHandler('/api');
  const request = async (method,payload = {}) => {
    const response = await handler.fetch(new Request('http://localhost/api/dsh-file-manager',{
      method:'POST',headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ type:'client-request',rpcId:'runtime-regression',method:'dsh-file-manager',payload:{ method,payload } }),
    }),{ principal:{ kind:'owner' } });
    assert.equal(response.status,200,await response.clone().text());
    return (await response.json()).result;
  };
  return { base,ctx,request };
}

test('Library RPC works before any agent services exist, and tools can arrive later',async t => {
  const { ctx,base,request } = await runtimeFixture(t);
  assert.equal((await request('status')).value.configured,false);
  assert.equal((await request('configure',{ directory:path.join(base,'library') })).ok,true);
  assert.equal((await request('note',{ content:'跨会话资料',name:'note.md' })).ok,true);
  assert.equal((await request('list')).value.total,1);
  await ctx.plugin(SystemPrompt,{});
  await ctx.plugin(Tools,{});
  await Promise.all([...ctx.registry.values()].flatMap(runtime => Array.from(runtime.fibers,fiber => fiber.await())));
  const prompt = await ctx.get('systemPrompt').assemble();
  assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,8);
  assert.equal(prompt.sections.some(section => section.name === 'library:usage'),true);
});

test('a failed startup directory reports its error through RPC and can be repaired',async t => {
  const { base,request } = await runtimeFixture(t,{ brokenDirectory:true,agentServices:true });
  const status = await request('status');
  assert.equal(status.ok,true);
  assert.equal(status.value.configured,false);
  assert.ok(status.value.initializationError.message);
  assert.equal((await request('list')).ok,false);
  assert.equal((await request('configure',{ directory:path.join(base,'repaired') })).ok,true);
  assert.equal((await request('status')).value.initializationError,null);
  assert.equal((await request('note',{ content:'recovered' })).ok,true);
  assert.equal((await request('list')).value.total,1);
});

test('authenticated assets return real thumbnails and reject a non-owner peer',async t => {
  const { ctx,base,request }=await runtimeFixture(t);
  await request('configure',{ directory:path.join(base,'library') });
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  // A generated PNG avoids relying on malformed sample-image CRCs.
  const { default:sharp }=await import('sharp');
  const bytes=await sharp({ create:{ width:960,height:1440,channels:3,background:'#6087a5' } }).png().toBuffer();
  const saved=await request('upload',{ name:"reader's image.png",base64:bytes.toString('base64') });
  assert.equal(saved.ok,true);
  const handler=ctx.get('connection').createSharedFetchHandler('/api');
  const url='http://localhost/api/dsh-file-manager/asset?id='+saved.value.id+'&thumbnail=1&v='+saved.value.sha256;
  const responses=await Promise.all(Array.from({ length:6 },() => handler.fetch(new Request(url),{ principal:{ kind:'owner' } })));
  for (const value of responses) assert.equal(value.status,200);
  const response=responses[0];
  assert.match(response.headers.get('content-disposition'),/reader%27s/);
  assert.equal(response.status,200,await response.clone().text());
  assert.equal(response.headers.get('content-type'),'image/webp');
  const metadata=await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.ok(metadata.width<=480); assert.ok(metadata.height<=640);
  assert.equal((await handler.fetch(new Request(url),{ principal:{ kind:'guest' } })).status,403);
  const svg=await request('upload',{ name:'unsafe.svg',base64:Buffer.from('<svg onload="alert(1)"/>').toString('base64') });
  const raw=await handler.fetch(new Request('http://localhost/api/dsh-file-manager/asset?id='+svg.value.id),{ principal:{ kind:'owner' } });
  assert.equal(raw.headers.get('content-type'),'application/octet-stream');
  assert.match(raw.headers.get('content-disposition'),/attachment/);
  const missing=await handler.fetch(new Request('http://localhost/api/dsh-file-manager/asset?id=../../outside'),{ principal:{ kind:'owner' } });
  assert.equal(missing.status,404);
});


test('default 128 MiB cap accepts a real upload larger than the former 32 MiB limit',async t => {
  const { base,request }=await runtimeFixture(t);
  await request('configure',{ directory:path.join(base,'library') });
  assert.equal((await request('status')).value.maxFileBytes,128 * 1024 * 1024);
  const bytes=Buffer.alloc(33 * 1024 * 1024,0x5a);
  const result=await request('upload',{ name:'large-original.bin',base64:bytes.toString('base64'),title:'大文件回归' });
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.value.bytes,bytes.length);
  assert.deepEqual(await readFile(result.value.path),bytes);
});


test('large-upload validation still rejects invalid alphabet, length and padding',async t => {
  const { base,request }=await runtimeFixture(t);
  await request('configure',{ directory:path.join(base,'library') });
  for (const base64 of ['A===','AA=A','AAAA=','____','a b=','====','a===','AA==\n']) {
    const result=await request('upload',{ name:'invalid.bin',base64 });
    assert.equal(result.ok,false,base64);
    assert.equal(result.error.code,'invalid-upload',base64);
  }
  for (const base64 of ['TQ==','TWE=','TWFu']) {
    const result=await request('upload',{ name:'valid.bin',base64 });
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.deepEqual(await readFile(result.value.path),Buffer.from(base64,'base64'));
  }
});
