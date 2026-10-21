import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
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
    const prompt = await ctx.get('systemPrompt').assemble();
    assert.equal(prompt.tools.filter(tool => tool.name.startsWith('library_')).length,6);
    assert.equal(prompt.sections.some(section => section.name === 'library:usage'),true);
  } finally {
    await ctx.fiber.dispose();
    await rm(base,{ recursive:true,force:true });
  }
});
