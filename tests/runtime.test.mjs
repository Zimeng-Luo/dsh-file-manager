import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
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
    assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,6);
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
  assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,6);
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
