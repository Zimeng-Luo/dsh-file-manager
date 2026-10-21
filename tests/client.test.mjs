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
  const client=await clientExports(),entries=[],locales=new Map(),effects=[];
  const ctx={
    effect(activate) { const stop=activate(); if (stop) effects.push(stop); },
    inject(_dependencies,activate) { return activate(ctx); },
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
  for (const stop of effects.reverse()) await stop();
});
test('page configures a host directory then saves and displays a note through RPC',async () => {
  const { LibraryPage }=await clientExports(); let configured=false;
  const stored=[],calls=[];
  const api=async (method,payload) => {
    calls.push({ method,payload });
    if (method==='status') return { configured,directory:configured ? '/library' : '',maxFileBytes:1024,pollIntervalMs:100000 };
    if (method==='configure') { configured=true; return { configured,directory:payload.directory }; }
    if (method==='list') return { items:stored,total:stored.length,nextOffset:null };
    if (method==='note') {
      stored.push({ id:'note-1',title:payload.title,name:payload.name,bytes:payload.content.length,tags:[],indexStatus:'indexed',path:'/library/note.md' });
      return stored.at(-1);
    }
    throw new Error('Unexpected operation: '+method);
  };
  let renderer;
  try {
    await act(async () => { renderer=create(React.createElement(LibraryPage,{ api,t:key => key })); });
    const root=renderer.root;
    await act(async () => { root.findByProps({ id:'dlf-directory' }).props.onChange({ target:{ value:'/library' } }); });
    await act(async () => {
      root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} });
      await new Promise(resolve => setImmediate(resolve));
    });
    assert.equal(calls.some(call => call.method==='configure' && call.payload.directory==='/library'),true);
    await act(async () => { root.findAllByType('button').find(button => button.children.includes('newNote')).props.onClick(); });
    let form=root.findAllByType('form').find(candidate => candidate.findAllByType('textarea').length);
    await act(async () => {
      form.findAllByType('input')[0].props.onChange({ target:{ value:'跨会话方案' } });
      form.findByType('textarea').props.onChange({ target:{ value:'下个会话继续使用' } });
    });
    form=root.findAllByType('form').find(candidate => candidate.findAllByType('textarea').length);
    await act(async () => {
      form.props.onSubmit({ preventDefault() {} });
      await new Promise(resolve => setImmediate(resolve));
    });
    assert.equal(stored[0].title,'跨会话方案');
    assert.equal(JSON.stringify(renderer.toJSON()).includes('跨会话方案'),true);
  } finally { if (renderer) await act(async () => renderer.unmount()); }
});
