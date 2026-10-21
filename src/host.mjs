import path from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { DEFAULTS } from './library.mjs';
import { LibraryManager } from './manager.mjs';
import { createLibraryTools } from './tools.mjs';
import { installLibraryRpc } from './rpc.mjs';

export const name = 'dsh-file-manager';
export const inject = ['tools','systemPrompt','fs','workingDirectory'];
export const Config = z.object({
  directory: z.string().default(''),stateDir: z.string().default(''),
  maxFileBytes: z.number().int().positive().default(DEFAULTS.maxFileBytes),
  maxTextChars: z.number().int().positive().default(DEFAULTS.maxTextChars),
  chunkChars: z.number().int().positive().default(DEFAULTS.chunkChars),
  maxScanFiles: z.number().int().positive().default(DEFAULTS.maxScanFiles),
  pollIntervalMs: z.number().int().min(1000).default(5000),
});

/** Mount shared storage, native model tools, skill guidance and optional browser RPC. */
export async function apply(ctx,input = {}) {
  const config = Config.parse(input);
  config.stateDir ||= path.join(process.env.DSH_HOME ?? path.join(homedir(),'.dsh'),'integrations','file-manager');
  if (!path.isAbsolute(config.stateDir)) throw new Error('stateDir must be an absolute host path.');
  const manager = new LibraryManager(config);
  await manager.ready;
  ctx.effect(() => () => manager.close(),'library: close shared storage');
  ctx.provide('library',manager);
  for (const tool of createLibraryTools(manager,ctx.fs,ctx.workingDirectory)) ctx.effect(() => ctx.tools.register(tool),'library: ' + tool.name);
  const skill = await readFile(new URL('../skills/library/SKILL.md',import.meta.url),'utf8');
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'library:usage',order: 240,interpolate: false,
    text: skill.replace(/^---\n[\s\S]*?\n---\n/,''),
  }),'library: model instructions');
  ctx.inject(['connection'],rpcCtx => {
    rpcCtx.effect(() => installLibraryRpc(rpcCtx,manager),'library: authenticated browser operations');
  });
}
