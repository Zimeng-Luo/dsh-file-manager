import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Library } from '../src/library.mjs';

async function fixture(t) {
  const base=await mkdtemp(path.join(tmpdir(),'library-organize-'));
  const library=await Library.open(path.join(base,'library'));
  t.after(async () => { await library.close(); await rm(base,{ recursive:true,force:true }); });
  return { base,library };
}
const note=(library,name,extra={}) => library.store({ name,bytes:Buffer.from('shared research notes'),source:'note',...extra });

test('folders, favorites and edited metadata survive restart without moving original bytes',async t => {
  const { library }=await fixture(t);
  const parent=await library.createFolder({ name:'科研学习' });
  const child=await library.createFolder({ name:'项目资料',parentId:parent.id });
  const item=await note(library,'original.md',{ folderId:child.id,favorite:true,tags:['old'] });
  const updated=await library.update({ id:item.id,title:'研究方案',description:'跨会话索引',tags:['retrievalTag'],folderId:parent.id });
  assert.equal(updated.favorite,true); assert.equal(updated.folderId,parent.id); assert.equal(updated.path,item.path);
  assert.equal((await library.search('retrievalTag')).matches[0].id,item.id);
  assert.equal((await library.search('old')).matches.length,0);
  await library.close();
  const reopened=await Library.open(library.root);
  try {
    const listed=await reopened.browse({ folderId:parent.id,favorite:true,query:'研究',limit:1 });
    assert.equal(listed.total,1); assert.equal(listed.items[0].id,item.id);
    assert.equal((await reopened.folders()).folders.length,2);
    assert.equal(await readFile(item.path,'utf8'),'shared research notes');
  } finally { await reopened.close(); }
});

test('filtered full text queries apply folders and favorites before pagination',async t => {
  const { library }=await fixture(t);
  const folder=await library.createFolder({ name:'目标文件夹' });
  const wanted=await note(library,'wanted.md',{ folderId:folder.id,favorite:true });
  for (let index=0;index<35;index++) await note(library,'other-'+index+'.md');
  const result=await library.browse({ query:'research',favorite:true,folderId:folder.id,limit:1 });
  assert.equal(result.total,1); assert.equal(result.items[0].id,wanted.id); assert.equal(result.nextOffset,null);
  assert.equal((await library.browse({ kind:'notes',limit:10 })).nextOffset,10);
  assert.equal((await library.browse({ query:'research',sort:'name',offset:10,limit:10 })).items.length,10);
  assert.equal((await library.browse({ kind:'images' })).total,0);
});

test('removing a folder promotes its items and children and preserves files',async t => {
  const { library }=await fixture(t);
  const parent=await library.createFolder({ name:'上级' });
  const folder=await library.createFolder({ name:'整理中',parentId:parent.id });
  const child=await library.createFolder({ name:'子文件夹',parentId:folder.id });
  const item=await note(library,'keep.md',{ folderId:folder.id });
  await library.renameFolder({ id:folder.id,name:'已整理' });
  await library.removeFolder({ id:folder.id });
  assert.equal((await library.read(item.id)).folderId,parent.id);
  assert.equal((await library.folders()).folders.find(value => value.id===child.id).parentId,parent.id);
  assert.equal(await readFile(item.path,'utf8'),'shared research notes');
});

test('folder conflicts roll back and invalid filters do not alter the index',async t => {
  const { library }=await fixture(t);
  const a=await library.createFolder({ name:'A' });
  await library.createFolder({ name:'same',parentId:a.id });
  await library.createFolder({ name:'same' });
  await assert.rejects(library.removeFolder({ id:a.id }),/conflicting/);
  assert.equal((await library.folders()).folders.length,3);
  await assert.rejects(library.createFolder({ name:'a' }),/already exists/);
  await assert.rejects(library.update({ id:'missing',favorite:true }),/not found/);
  await assert.rejects(library.store({ name:'never.md',bytes:Buffer.from('x'),folderId:'missing' }),/folder not found/i);
  for (const filters of [{ sort:"name; DROP TABLE items" },{ kind:'invalid' },{ favorite:'yes' },{ limit:101 }]) {
    assert.throws(() => library.browse(filters),/Unknown|boolean|limit/);
  }
  assert.equal((await library.list()).total,0);
});

test('opening a legacy v1 index adds organization tables while retaining item identity and text',async t => {
  const { library }=await fixture(t);
  const old=await note(library,'legacy.md');
  library.db.exec('DROP TABLE library_item_meta; DROP TABLE library_folders;');
  await library.close();
  const reopened=await Library.open(library.root);
  try {
    const item=(await reopened.search('research')).matches[0];
    assert.equal(item.id,old.id); assert.equal(item.sha256,old.sha256); assert.equal(item.path,old.path);
    assert.equal(item.favorite,false); assert.equal(item.folderId,'');
    const folder=await reopened.createFolder({ name:'旧资料' });
    await reopened.update({ id:old.id,folderId:folder.id,favorite:true });
    assert.equal((await reopened.browse({ favorite:true })).total,1);
  } finally { await reopened.close(); }
});
