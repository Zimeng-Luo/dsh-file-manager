import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { create,act } from 'react-test-renderer';

async function clientExports() {
  const source=await readFile(new URL('../client.js',import.meta.url),'utf8');
  let exports;
  new Function('window',source)({ __ModuleLoader__:{ load(module) {
    assert.equal(module.id,'dsh-file-manager');
    exports=module.factory(name => {
      if (name==='react') return React;
      throw new Error('Unexpected dependency: '+name);
    });
  } } });
  return exports;
}
test('client adds Library in the native sidebar panel group with its own main page',async () => {
  const client=await clientExports(),entries=[],sources=[],locales=new Map(),effects=[];
  const ctx={
    effect(activate) { const stop=activate(); if (stop) effects.push(stop); },
    inject(_dependencies,activate) { return activate(ctx); },
    inputTriggers:{ registerSource(source) { sources.push(source); return () => sources.splice(sources.indexOf(source),1); } },
    slots:{
      inject(_slot,activate) { const stop=activate(); return typeof stop==='function' ? stop : () => {}; },
      register(options,component) { entries.push({ options,component }); return () => {}; },
    },
    locale:{
      register(namespace,dictionary) { locales.set(namespace,dictionary); return () => {}; },
      bind(namespace) { return key => locales.get(namespace).zh[key]; },
    },
    connection:{ rpc:{ async call() { return { ok:true,value:{} }; } } },
  };
  client.apply(ctx);
  const navigation=entries.find(entry => entry.options.name==='sidebar.panellist');
  const page=entries.find(entry => entry.options.name==='main');
  assert.equal(navigation.options.label(),'资料库');
  assert.equal(navigation.options.id,page.options.key);
  assert.equal(page.component,client.LibraryPage);
  assert.equal(sources.length,1);
  assert.equal(sources[0].trigger,'/');
  assert.equal(sources[0].name,'dsh-library');
  for (const stop of effects.reverse()) await stop();
});

function fakeApi(initialConfigured=true) {
  let configured=initialConfigured;
  const stored=[],folders=[],calls=[];
  const api=async (method,payload={}) => {
    calls.push({ method,payload });
    if (method==='status') return { configured,directory:configured ? '/library' : '',maxFileBytes:1024,pollIntervalMs:100000 };
    if (method==='configure') { configured=true; return { configured,directory:payload.directory }; }
    if (method==='folders') return { folders:folders.map(folder => ({ ...folder,count:stored.filter(item => item.folderId===folder.id).length,covers:stored.filter(item => item.folderId===folder.id && item.kind==='image') })) };
    if (method==='browse') {
      let items=stored.filter(item => payload.folderId===undefined || item.folderId===payload.folderId);
      if (payload.favorite) items=items.filter(item => item.favorite);
      if (payload.kind==='images') items=items.filter(item => item.kind==='image');
      if (payload.query) items=items.filter(item => item.title.includes(payload.query));
      return { items,total:items.length,nextOffset:null };
    }
    if (method==='note') {
      const item={ id:'note-'+stored.length,title:payload.title,name:payload.name,bytes:payload.content.length,tags:payload.tags ?? [],indexStatus:'indexed',path:'/library/note.md',folderId:payload.folderId ?? '',kind:'note' };
      stored.push(item); return item;
    }
    if (method==='createFolder') { const folder={ id:'f'+folders.length,name:payload.name,parentId:payload.parentId ?? '',covers:[] }; folders.push(folder); return folder; }
    if (method==='update') { const item=stored.find(item => item.id===payload.id); Object.assign(item,payload); return { ...item }; }
    if (method==='read') return { ...stored.find(item => item.id===payload.id),text:'preview text',nextOffset:null };
    throw new Error('Unexpected operation: '+method);
  };
  return { api,stored,folders,calls };
}
const flush=callback => act(async () => { callback?.(); await new Promise(resolve => setImmediate(resolve)); });
const textButton=(root,label) => root.findAllByType('button').find(button => button.children.includes(label));

test('page configures its directory and creates a visible tagged note through the New menu',async () => {
  const { LibraryPage }=await clientExports(),state=fakeApi(false);
  let renderer;
  try {
    await flush(() => { renderer=create(React.createElement(LibraryPage,{ api:state.api,t:key => key })); });
    const root=renderer.root;
    await flush(() => root.findByProps({ id:'dlf-directory' }).props.onChange({ target:{ value:'/library' } }));
    await flush(() => root.findAllByType('form').find(form => form.findAllByProps({ id:'dlf-directory' }).length).props.onSubmit({ preventDefault() {} }));
    assert.equal(state.calls.some(call => call.method==='configure' && call.payload.directory==='/library'),true);
    assert.equal(root.findAllByProps({ id:'dlf-directory' }).length,0,'configured library hides directory settings');
    await flush(() => textButton(root,'new').props.onClick());
    await flush(() => textButton(root,'newNote').props.onClick());
    await flush(() => {
      root.findByProps({ id:'dlf-note-title' }).props.onChange({ target:{ value:'跨会话方案' } });
      root.findByProps({ id:'dlf-note-content' }).props.onChange({ target:{ value:'下个会话继续使用' } });
      root.findByProps({ id:'dlf-note-tags' }).props.onChange({ target:{ value:'项目，方案' } });
    });
    await flush(() => root.findAllByType('form').find(form => form.findAllByProps({ id:'dlf-note-content' }).length).props.onSubmit({ preventDefault() {} }));
    assert.equal(state.stored[0].title,'跨会话方案');
    assert.deepEqual(state.stored[0].tags,['项目','方案']);
    assert.match(JSON.stringify(renderer.toJSON()),/跨会话方案/);
  } finally { if (renderer) await flush(() => renderer.unmount()); }
});

test('gallery exposes thumbnails, real favorites, folder navigation and the list view',async () => {
  const { LibraryPage }=await clientExports(),state=fakeApi();
  state.folders.push({ id:'research',name:'科研学习',parentId:'' });
  state.stored.push({ id:'image',name:'image.png',title:'实验图片',kind:'image',bytes:100,tags:[],path:'/library/image.png',folderId:'research',favorite:false,sha256:'abc',indexStatus:'metadata-only' });
  let renderer;
  try {
    await flush(() => { renderer=create(React.createElement(LibraryPage,{ api:state.api,t:key => key })); });
    const root=renderer.root;
    assert.ok(root.findAllByType('img').some(img => img.props.src.includes('/asset?id=image') && img.props.src.includes('thumbnail=1')));
    await flush(() => root.findAllByType('button').find(button => button.props['aria-label']==='favorite').props.onClick());
    assert.equal(state.stored[0].favorite,true);
    await flush(() => textButton(root,'favorites').props.onClick());
    assert.equal(state.calls.filter(call => call.method==='browse').at(-1).payload.favorite,true);
    await flush(() => textButton(root,'all').props.onClick());
    await flush(() => root.findByProps({ 'aria-label':'folder 科研学习' }).props.onClick());
    assert.equal(state.calls.filter(call => call.method==='browse').at(-1).payload.folderId,'research');
    await flush(() => root.findByProps({ 'aria-label':'listView' }).props.onClick());
    assert.equal(root.findAllByType('table').length,1);
    await flush(() => root.findByProps({ 'aria-label':'settings' }).props.onClick());
    assert.equal(root.findAllByProps({ id:'dlf-directory' }).length,1);
  } finally { if (renderer) await flush(() => renderer.unmount()); }
});


test('native /library source searches the shared library and inserts durable file references',async () => {
  const client=await clientExports(),state=fakeApi();
  state.stored.push({ id:'shared-id',name:'合同.docx',title:'项目合同',tags:['项目'],path:'F:/Library/files/shared-id/合同.docx' });
  const source=client.createReferenceSource(state.api,key=>key),signal=new AbortController().signal;
  const session={ sessionId:'unrelated-workspace' };
  const request=query=>source.candidates(session,{ query,signal,position:'inline' });
  const commands=await request('lib');
  assert.equal(commands.length,1);
  assert.deepEqual(source.onPick({ candidate:commands[0] }),{ text:'/library:',continue:true });
  assert.deepEqual(await request('other'),[]);
  const recent=await request('library');
  assert.equal(recent.length,1);
  const hits=await request('library:合同');
  assert.equal(state.calls.filter(call=>call.method==='browse').at(-1).payload.query,'合同');
  assert.equal(state.calls.filter(call=>call.method==='browse').at(-1).payload.folderId,undefined,'search spans every folder and workspace');
  const outcome=source.onPick({ candidate:hits[0] });
  assert.deepEqual(outcome.insert,{ source:'dsh-library',ref:'shared-id',label:'项目合同',appearance:'file',clipboardText:'[[library:shared-id]]' });
  assert.deepEqual(source.matchSpace(session,'/library'),{ text:'/library:',continue:true });
  assert.deepEqual(await source.matchEnter(session,'/library'),{ text:'/library:',continue:true });
  assert.equal(await source.matchEnter(session,'/library this is a normal question'),undefined);
  state.stored[0].title='发送前已重命名';
  const serialized=await source.codec.serialize(outcome.insert.ref,signal);
  assert.match(serialized,/\[\[library:shared-id\]\]/);
  assert.match(serialized,/发送前已重命名/);
  assert.equal(state.calls.at(-1).method,'read');
  assert.equal(source.codec.clipboardText('shared-id'),'[[library:shared-id]]');
  await assert.rejects(source.codec.serialize('shared-id',AbortSignal.abort()),/cancelled/);
  const missing=client.createReferenceSource(async()=>{ throw new Error('File is no longer available'); },key=>key);
  await assert.rejects(missing.codec.serialize('shared-id',signal),/no longer available/);
});

test('/library reports setup and empty search without manufacturing file references',async () => {
  const { createReferenceSource }=await clientExports(),signal=new AbortController().signal;
  const unconfigured=createReferenceSource(fakeApi(false).api,key=>key);
  const setup=await unconfigured.candidates({ sessionId:'a' },{ query:'library',signal });
  assert.equal(setup[0].description,'referenceSetup');
  assert.equal(unconfigured.onPick({ candidate:setup[0] }),undefined);
  const empty=createReferenceSource(fakeApi().api,key=>key);
  const rows=await empty.candidates({ sessionId:'b' },{ query:'library:missing',signal });
  assert.equal(rows[0].description,'referenceEmpty');
  assert.equal(empty.onPick({ candidate:rows[0] }),undefined);
});
