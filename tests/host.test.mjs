import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { apply } from '../src/host.mjs';

test('native plugin mounts six tools, skill instructions, shared storage and browser RPC',async () => {
  const base=await mkdtemp(path.join(tmpdir(),'dsh-library-host-')),effects=[],pending=[],tools=[],sections=[],routes=[];
  const ctx={
    effect(activate) { const stop=activate(); if (stop) effects.push(stop); },
    provide(name,value) { this[name]=value; },
    inject(_dependencies,activate) { const result=activate(ctx); pending.push(result); return result; },
    get(name) { return this[name]; },
    tools:{ register(tool) { tools.push(tool); return () => {}; } },
    systemPrompt:{ section(value) { sections.push(value); return () => {}; } },
    fs:{},workingDirectory:{},
    connection:{ fetch:{ register(route) { routes.push(route); return () => {}; } } },
  };
  try {
    await apply(ctx,{ directory:path.join(base,'library'),stateDir:path.join(base,'state') });
    await Promise.all(pending);
    assert.equal(tools.length,6);
    assert.equal(sections[0].text.includes('library_store'),true);
    assert.equal(sections[0].text.includes('之前保存的资料'),true);
    assert.equal(routes[0].path,'/api/dsh-file-manager');
    assert.equal((await ctx.library.status()).configured,true);
  } finally {
    for (const stop of effects.reverse()) await stop();
    await rm(base,{ recursive:true,force:true });
  }
});
