import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp,readFile,writeFile,mkdir,rm,symlink,realpath } from 'node:fs/promises';
import { Library,safeName } from '../src/library.mjs';
import { LibraryManager } from '../src/manager.mjs';
import { createLibraryTools } from '../src/tools.mjs';
import { dispatch,installLibraryRpc,RPC_METHOD } from '../src/rpc.mjs';
import { tokenize } from '../src/extract.mjs';
async function fixture(t,options={}) {
  const base=await mkdtemp(path.join(tmpdir(),'dsh-library-'));
  const library=await Library.open(path.join(base,'library'),options);
  t.after(async () => { await library.close(); await rm(base,{ recursive:true,force:true }); });
  return { base,library };
}
test('stored documents survive restart and remain readable in another conversation',async t => {
  const { base,library }=await fixture(t),source=path.join(base,'project-note.md');
  const body='# Invoice\n发票归档：青松项目，金额12345元。';
  await writeFile(source,body);
  const saved=await library.store({ bytes:await readFile(source),name:'合同与发票.md',title:'青松项目资料',description:'跨会话复用',tags:['财务'],source });
  assert.equal(await readFile(source,'utf8'),body);
  assert.equal((await library.search('青松')).matches[0].id,saved.id);
  assert.equal((await library.search('财务')).matches[0].id,saved.id);
  assert.equal((await library.read(saved.id)).text.includes('12345'),true);
  await library.close();
  const reopened=await Library.open(library.root);
  try {
    assert.equal((await reopened.search('发票')).matches[0].id,saved.id);
    assert.equal((await reopened.read(saved.id)).sha256,saved.sha256);
  } finally { await reopened.close(); }
});
test('same-name imports retain both originals and paginate independently',async t => {
  const { library }=await fixture(t);
  const a=await library.store({ bytes:Buffer.from('one'),name:'note.md' });
  const b=await library.store({ bytes:Buffer.from('two'),name:'note.md' });
  assert.notEqual(a.path,b.path);
  assert.equal(await readFile(a.path,'utf8'),'one'); assert.equal(await readFile(b.path,'utf8'),'two');
  const first=await library.list({ limit:1 });
  assert.equal(first.total,2); assert.equal(first.nextOffset,1);
  const next=await library.list({ offset:first.nextOffset,limit:1 });
  assert.notEqual(first.items[0].id,next.items[0].id); assert.equal(next.nextOffset,null);
});
test('binary files and failed parsers retain visible searchable records',async t => {
  const { library }=await fixture(t);
  const image=await library.store({ bytes:Buffer.from([0,1,2]),name:'产品图片.png',tags:['设计'] });
  assert.equal(image.indexStatus,'metadata-only');
  assert.equal((await library.search('产品')).matches[0].id,image.id);
  assert.equal((await library.search('设计')).matches[0].id,image.id);
  assert.equal((await library.read(image.id)).text,'');
  const broken=await library.store({ bytes:Buffer.from('not a document'),name:'broken.docx' });
  assert.equal(broken.indexStatus,'error'); assert.equal((await library.list()).total,2);
});
test('manual files are discovered, changed text is updated and deleted files disappear',async t => {
  const { library }=await fixture(t),target=path.join(library.root,'external.md');
  await writeFile(target,'old-reference');
  assert.equal((await library.refresh()).indexed,1);
  const item=(await library.search('old')).matches[0];
  await writeFile(target,'changed and longer reference');
  assert.equal((await library.read(item.id)).text,'changed and longer reference');
  assert.equal((await library.search('old')).matches.length,0);
  assert.equal((await library.search('changed')).matches[0].id,item.id);
  await rm(target);
  assert.equal((await library.refresh()).removed,1); assert.equal((await library.list()).total,0);
});
test('text caps and pagination report omitted content',async t => {
  const { library }=await fixture(t,{ maxTextChars:12,chunkChars:5 });
  const item=await library.store({ bytes:Buffer.from('abcdefghijklmnop'),name:'long.md' });
  assert.equal(item.textTruncated,true);
  const first=await library.read(item.id,{ limit:5 });
  assert.equal(first.text,'abcde'); assert.equal(first.nextOffset,5); assert.equal(first.totalChars,12);
  const last=await library.read(item.id,{ offset:10,limit:5 });
  assert.equal(last.text,'kl'); assert.equal(last.nextOffset,null);
});
test('path-like names and oversized imports are rejected',async t => {
  const { library }=await fixture(t,{ maxFileBytes:4 });
  for (const name of ['../secret','folder/file','folder\\file','C:secret','CON.txt','trailing.','x ']) assert.throws(() => safeName(name),/filename/i);
  await assert.rejects(library.store({ bytes:Buffer.from('12345'),name:'large.md' }),/maxFileBytes/);
  assert.equal((await library.list()).total,0);
});
test('directory links are skipped and replaced file links cannot expose outside content',async t => {
  const { base,library }=await fixture(t),outside=path.join(base,'private');
  await mkdir(outside); await writeFile(path.join(outside,'secret.md'),'outside secret');
  try { await symlink(outside,path.join(library.root,'shortcut'),process.platform==='win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code==='EPERM') { t.skip('Symlink creation unavailable'); return; } throw error; }
  await library.refresh(); assert.equal((await library.list()).total,0);
  const item=await library.store({ bytes:Buffer.from('safe'),name:'note.md' });
  await rm(item.path);
  try { await symlink(path.join(outside,'secret.md'),item.path); }
  catch (error) { if (error.code==='EPERM') { t.skip('File symlink creation unavailable'); return; } throw error; }
  await assert.rejects(library.read(item.id),/links|junctions/);
  assert.equal((await library.search('safe')).matches.length,0);
});
test('Session A source uses its filesystem; Session B can search the stored copy',async t => {
  const base=await mkdtemp(path.join(tmpdir(),'dsh-library-tools-'));
  const manager=new LibraryManager({ directory:path.join(base,'library'),stateDir:path.join(base,'state'),maxFileBytes:1024 });
  t.after(async () => { await manager.close(); await rm(base,{ recursive:true,force:true }); });
  await manager.ready;
  const calls=[],fs={
    async resolve(source,options) { calls.push({ source,options }); return { opaque:'target' }; },
    async readBytes(target,_signal,max) { assert.deepEqual(target,{ opaque:'target' }); assert.equal(max,1024); return Buffer.from('共享参考内容'); },
  };
  const tools=createLibraryTools(manager,fs,{ get:session => session.cwd }),save=tools.find(tool => tool.name==='library_store');
  const a={ agent:{ session:{ cwd:'/project-a' } } },b={ agent:{ session:{ cwd:'/project-b' } } };
  const stored=await save.execute({ sourcePath:'参考.md' },a);
  assert.equal(calls[0].options.cwd,'/project-a');
  assert.equal((await tools.find(tool => tool.name==='library_search').execute({ query:'共享' },b)).matches[0].id,stored.id);
  await assert.rejects(save.execute({ sourcePath:'a',content:'b' },a),/exactly one/);
});
test('directory selection persists and switching libraries keeps contents separate',async t => {
  const base=await mkdtemp(path.join(tmpdir(),'dsh-library-settings-')),config={ stateDir:path.join(base,'state'),directory:'' };
  let manager=new LibraryManager(config);
  t.after(async () => { await manager.close(); await rm(base,{ recursive:true,force:true }); });
  await manager.ready; assert.equal((await manager.status()).configured,false);
  await assert.rejects(manager.call('list'),/configure/i);
  await manager.configure(path.join(base,'first'));
  const item=await manager.call('store',{ bytes:Buffer.from('first-library'),name:'first.md' });
  await manager.configure(path.join(base,'second')); assert.equal((await manager.call('list')).total,0);
  await manager.close(); manager=new LibraryManager(config); await manager.ready;
  assert.equal((await manager.status()).directory,await realpath(path.join(base,'second')));
  await manager.configure(path.join(base,'first'));
  assert.equal((await manager.call('read',item.id)).text,'first-library');
});
test('UI and tools share storage; malformed uploads fail; RPC correlates responses',async t => {
  const base=await mkdtemp(path.join(tmpdir(),'dsh-library-rpc-'));
  const manager=new LibraryManager({ directory:path.join(base,'library'),stateDir:path.join(base,'state') });
  t.after(async () => { await manager.close(); await rm(base,{ recursive:true,force:true }); }); await manager.ready;
  const note=await dispatch(manager,'note',{ name:'说明.md',content:'其他会话能找到这份资料' });
  assert.equal((await manager.call('search','其他会话')).matches[0].id,note.id);
  await assert.rejects(dispatch(manager,'upload',{ name:'bad.md',base64:'not-base64!' }),/base64/);
  await assert.rejects(dispatch(manager,'list',{ directory:'/elsewhere' }),/fields/);
  let route;
  installLibraryRpc({ connection:{ fetch:{ register(value) { route=value; return () => {}; } } } },manager);
  const response=await route.fetch(new Request('http://localhost/api/'+RPC_METHOD,{
    method:'POST',headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ type:'client-request',method:RPC_METHOD,rpcId:'request-7',payload:{ method:'list',payload:{} } }),
  }));
  const result=await response.json(); assert.equal(result.rpcId,'request-7'); assert.equal(result.result.value.total,1);
});
test('scan limits report incomplete discovery',async t => {
  const { library }=await fixture(t,{ maxScanFiles:1 });
  await writeFile(path.join(library.root,'one.md'),'one'); await writeFile(path.join(library.root,'two.md'),'two');
  const result=await library.refresh(); assert.equal(result.scanned,1); assert.equal(result.capped,true); assert.equal((await library.list()).total,1);
});
test('many chunks from one file do not hide other matching files',async t => {
  const { library }=await fixture(t,{ chunkChars:8 });
  await library.store({ bytes:Buffer.from('example '.repeat(500)),name:'example-long.md' });
  const short=await library.store({ bytes:Buffer.from('example short'),name:'short.md' });
  const matches=(await library.search('example',10)).matches;
  assert.equal(matches.length,2); assert.equal(matches.some(item => item.id===short.id),true);
});
test('long unbroken Chinese runs tokenize without exceeding the call stack',() => {
  const terms=tokenize('资料'.repeat(100000)); assert.equal(terms.includes('资料'),true); assert.equal(terms.includes('资'),true);
});
