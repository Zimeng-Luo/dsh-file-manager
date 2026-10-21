import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection';
import * as Host from '../src/host.mjs';

test('the installed plugin starts when its bundle row omits config',async () => {
  const base = await mkdtemp(path.join(tmpdir(),'library-default-config-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = base;
  const ctx = new Context();
  try {
    await ctx.plugin({ name:'default-config-connection',apply(ctx) {
      new HostConnectionService(ctx,[],{ isAuthenticated:() => true });
    } });
    await ctx.plugin(Host);
    await Promise.all([...ctx.registry.values()].flatMap(runtime => Array.from(runtime.fibers,fiber => fiber.await())));
    const handler = ctx.get('connection').createSharedFetchHandler('/api');
    const response = await handler.fetch(new Request('http://localhost/api/dsh-file-manager',{
      method:'POST',headers:{ 'content-type':'application/json' },
      body:JSON.stringify({ type:'client-request',rpcId:'default-config',method:'dsh-file-manager',payload:{ method:'status',payload:{} } }),
    }),{ principal:{ kind:'owner' } });
    assert.equal(response.status,200,await response.clone().text());
    assert.equal((await response.json()).result.value.configured,false);
    assert.equal(Host.Config.parse(undefined).maxFileBytes,32 * 1024 * 1024);
  } finally {
    await ctx.fiber.dispose();
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(base,{ recursive:true,force:true });
  }
});
