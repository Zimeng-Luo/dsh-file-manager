import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp,readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium,expect } from '@playwright/test';
import sharp from 'sharp';
import { LibraryManager } from '../src/manager.mjs';
import { installLibraryRpc } from '../src/rpc.mjs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const base=await mkdtemp(path.join(tmpdir(),'library-browser-'));
const manager=new LibraryManager({ directory:path.join(base,'library'),stateDir:path.join(base,'state') });
const routes=new Map();
const stop=installLibraryRpc({ connection:{ fetch:{ register(route) { routes.set(route.path,route); return () => routes.delete(route.path); } } } },manager);
let browser,server;
const output=path.resolve('.artifacts');
await mkdir(output,{ recursive:true });
try {
  await manager.ready;
  const names=['课内学习','科研学习','调研助手','创作助手'];
  const folders=[];
  for (const name of names) folders.push(await manager.call('createFolder',{ name }));
  const colors=[['#314a5e','#c69778'],['#6e745e','#d5c7a3'],['#454066','#b6a7d2'],['#8d6756','#e3c9aa'],['#31545c','#99bec3'],['#6c5d75','#d3b4bb'],['#576c4b','#b9c8a1'],['#385c80','#adc7dd']];
  const titles=['配置灵感.png','山野记录.jpg','设计草图.png','阅读清单.png','实验观察.png','春日色彩.png','项目海报.png','产品方案.png'];
  let firstImage;
  for (let index=0;index<8;index++) {
    const width=900,height=[1150,680,1280,1100,1350,720,1220,1000][index];
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="'+colors[index][0]+'"/><stop offset="1" stop-color="'+colors[index][1]+'"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="690" cy="230" r="140" fill="#fff" opacity=".18"/><path d="M0 '+(height*.55)+' Q280 '+(height*.32)+' 510 '+(height*.64)+' T900 '+(height*.52)+' V'+height+' H0" fill="#fff" opacity=".14"/><rect x="76" y="90" width="105" height="4" fill="#fff" opacity=".7"/><text x="76" y="158" font-family="sans-serif" font-size="30" fill="#fff" opacity=".8">LIBRARY / '+String(index+1).padStart(2,'0')+'</text><text x="76" y="'+(height-110)+'" font-family="sans-serif" font-size="52" fill="#fff">Collected ideas</text><text x="80" y="'+(height-65)+'" font-family="sans-serif" font-size="20" fill="#fff" opacity=".65">A place for the work you want to keep.</text></svg>';
    const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
    const item=await manager.call('store',{ bytes,name:titles[index],title:titles[index],tags:['演示资料'],folderId:folders[index%4].id,source:'browser-upload' });
    if (index===0) firstImage=item;
  }
  // Reuse the test suite's minimal ZIP writer to create valid DOCX demo files.
  const documentTests=await readFile(new URL('../tests/documents.test.mjs',import.meta.url),'utf8');
  const helpers=documentTests.slice(documentTests.indexOf('function crc32'),documentTests.indexOf("test('DOCX"));
  const zip=new Function(helpers+';return zip;')();
  function docx(text) {
    return zip([
      ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:body></w:document>'],
    ]);
  }
  function pdf() {
    const stream='BT /F1 18 Tf 40 200 Td (Shared library research) Tj ET\n';
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'endstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let value='%PDF-1.4\n'; const offsets=[];
    objects.forEach((object,index) => { offsets.push(Buffer.byteLength(value)); value+=(index+1)+' 0 obj\n'+object+'\nendobj\n'; });
    const start=Buffer.byteLength(value); value+='xref\n0 6\n0000000000 65535 f \n';
    offsets.forEach(offset => { value+=String(offset).padStart(10,'0')+' 00000 n \n'; });
    return Buffer.from(value+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n');
  }
  const documents=['课程学习规划.docx','家长调研问卷.docx','实践队信息.docx','实验记录.docx','数字逻辑系统设计.pdf','文献阅读笔记.pdf'];
  for (let index=0;index<documents.length;index++) {
    await manager.call('store',{ name:documents[index],bytes:documents[index].endsWith('.pdf') ? pdf() : docx('共享资料库：学习规划与调研记录。'),tags:['演示资料'],folderId:folders[index%4].id });
  }
  const reactRoot=path.dirname(require.resolve('react/package.json')),domRoot=path.dirname(require.resolve('react-dom/package.json'));
  const staticFiles=new Map([
    ['/react.js',await readFile(path.join(reactRoot,'umd/react.production.min.js'))],
    ['/react-dom.js',await readFile(path.join(domRoot,'umd/react-dom.production.min.js'))],
    ['/client.js',await readFile(new URL('../client.js',import.meta.url))],
  ]);
  const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH Library preview</title><style>html,body,#app{margin:0;width:100%;height:100%;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC",sans-serif;background:#09090b}button,input,select,textarea{font-family:inherit}</style></head><body><div id="app"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script>window.__ModuleLoader__={load:function(module){window.libraryClient=module.factory(function(name){if(name==="react")return React;throw Error(name)})}};</script><script src="/client.js"></script><script>let dictionary,entry,seq=0;const ctx={effect(fn){return fn()},inject(deps,fn){return fn(ctx)},locale:{register(id,d){dictionary=d.zh;return()=>{}},bind(){return key=>dictionary[key]??key}},slots:{inject(slot,fn){return fn()??(()=>{})},register(options,component){if(options.name==="main")entry={options,component};return()=>{}}},connection:{rpc:{async call(channel,method,payload,signal){const response=await fetch(channel+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"client-request",rpcId:"browser-"+(++seq),method,payload}),signal});if(!response.ok)throw Error("HTTP "+response.status);return(await response.json()).result}}}};window.libraryClient.apply(ctx);ReactDOM.createRoot(document.getElementById("app")).render(React.createElement(entry.component,entry.options.inject()));</script></body></html>';
  server=createServer(async (req,res) => {
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if (url.pathname==='/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (url.pathname==='/') { res.writeHead(200,{ 'content-type':'text/html; charset=utf-8' }); res.end(html); return; }
      if (staticFiles.has(url.pathname)) { res.writeHead(200,{ 'content-type':'text/javascript' }); res.end(staticFiles.get(url.pathname)); return; }
      const route=routes.get(url.pathname);
      if (!route || !route.methods.includes(req.method)) { res.writeHead(404); res.end(); return; }
      const chunks=[]; for await (const chunk of req) chunks.push(chunk);
      const request=new Request('http://127.0.0.1'+req.url,{ method:req.method,headers:req.headers,...(req.method==='GET' ? {} : { body:Buffer.concat(chunks) }) });
      const response=await route.fetch(request);
      res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500,{ 'content-type':'text/plain' }); res.end(String(error)); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({ headless:true });
  const page=await browser.newPage({ viewport:{ width:1900,height:1240 },deviceScaleFactor:1 });
  const errors=[]; page.on('pageerror',error => errors.push(String(error)));
  page.on('response',response => { if (response.url().includes('/api/') && response.status()>=400) errors.push('HTTP '+response.status()+' '+response.url()); });
  await page.goto(origin);
  await expect(page.getByRole('heading',{ name:'资料库',exact:true })).toBeVisible();
  await expect(page.locator('.dlf-card')).toHaveCount(14);
  await expect(page.locator('.dlf-folder')).toHaveCount(4);
  await expect(page.locator('#dlf-directory')).toHaveCount(0);
  const firstThumbnail=page.locator('.dlf-folder-stack img').first();
  await expect.poll(() => firstThumbnail.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path:path.join(output,'gallery-desktop.png'),fullPage:true });
  await page.getByRole('button',{ name:'预览 配置灵感.png',exact:true }).click();
  let dialog=page.getByRole('dialog');
  await expect.poll(() => dialog.locator('.dlf-preview-media img').evaluate(img => img.naturalWidth)).toBe(900);
  await dialog.getByRole('button',{ name:'收藏',exact:true }).click();
  await expect(dialog.getByRole('button',{ name:'取消收藏',exact:true })).toBeVisible();
  await dialog.getByRole('button',{ name:'编辑资料',exact:true }).click();
  await dialog.getByLabel('标题',{ exact:true }).fill('已整理的实验原图');
  await dialog.getByLabel('标签',{ exact:true }).fill('浏览器回归,原图');
  await dialog.getByLabel('所在文件夹',{ exact:true }).selectOption(folders[1].id);
  await dialog.getByRole('button',{ name:'保存',exact:true }).click();
  await expect(dialog.getByRole('heading',{ name:'已整理的实验原图',exact:true })).toBeVisible();
  await dialog.getByRole('button',{ name:'关闭',exact:true }).click();
  await page.getByRole('tab',{ name:'收藏',exact:true }).click();
  await expect(page.locator('.dlf-card')).toHaveCount(1);
  await expect(page.getByRole('button',{ name:'预览 已整理的实验原图',exact:true })).toBeVisible();
  await page.getByRole('tab',{ name:'推荐',exact:true }).click();
  await expect(page.locator('.dlf-card').first()).toHaveAttribute('data-item-id',firstImage.id);
  await page.getByRole('tab',{ name:'全部',exact:true }).click();
  await page.getByRole('button',{ name:'新建',exact:true }).click();
  await page.getByRole('menuitem',{ name:'新建文件夹',exact:true }).click();
  await page.getByLabel('文件夹名称',{ exact:true }).fill('回归文件夹');
  await page.getByRole('dialog').getByRole('button',{ name:'保存',exact:true }).click();
  await page.getByRole('button',{ name:'所在文件夹 回归文件夹',exact:true }).click();
  const upload=await sharp({ create:{ width:500,height:700,channels:3,background:'#719992' } }).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name:'上传测试.png',mimeType:'image/png',buffer:upload });
  await expect(page.getByRole('button',{ name:'预览 上传测试.png',exact:true })).toBeVisible();
  await page.getByRole('searchbox',{ name:'搜索资料库',exact:true }).fill('上传测试');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.dlf-card')).toHaveCount(1);
  await page.getByRole('button',{ name:'列表视图',exact:true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('checkbox',{ name:'选择资料 上传测试.png',exact:true }).check();
  await page.getByRole('button',{ name:'移动到文件夹',exact:true }).click();
  await page.getByLabel('选择目标文件夹',{ exact:true }).selectOption('');
  await page.getByRole('dialog').getByRole('button',{ name:'保存',exact:true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(0);
  const uploaded=(await manager.call('browse',{ query:'上传测试' })).items[0];
  assert.equal(uploaded.folderId,'');
  assert.deepEqual(await readFile(uploaded.path),upload);
  await page.getByRole('button',{ name:'编辑文件夹',exact:true }).click();
  await page.getByRole('dialog').getByRole('button',{ name:'移除文件夹',exact:true }).click();
  await expect(page.getByRole('navigation',{ name:'所在文件夹',exact:true })).toHaveCount(0);
  await expect(page.locator('.dlf-folder')).toHaveCount(4);
  await page.getByRole('button',{ name:'新建',exact:true }).click();
  await page.getByRole('menuitem',{ name:'新建笔记',exact:true }).click();
  await page.getByLabel('标题',{ exact:true }).fill('浏览器创建的笔记');
  await page.getByLabel('笔记内容',{ exact:true }).fill('另一会话还可以继续搜索这份笔记。');
  await page.getByRole('dialog').getByRole('button',{ name:'保存笔记',exact:true }).click();
  await expect(page.getByRole('table').getByRole('button',{ name:'浏览器创建的笔记',exact:true })).toBeVisible();
  const transfer=await page.evaluateHandle(bytes => { const transfer=new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)],'拖放上传.png',{ type:'image/png' })); return transfer; },Array.from(upload));
  await page.locator('.dlf-root').dispatchEvent('drop',{ dataTransfer:transfer });
  await expect(page.getByRole('table').getByRole('button',{ name:'拖放上传.png',exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'资料库设置',exact:true }).click();
  await expect(page.getByRole('dialog').getByLabel('资料库目录',{ exact:true })).toHaveValue(manager.config.directory);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{ name:'网格视图',exact:true }).click();
  await page.setViewportSize({ width:390,height:844 });
  await expect(page.locator('.dlf-card')).toHaveCount(17);
  await page.reload();
  await expect(page.getByRole('button',{ name:'网格视图',exact:true })).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.dlf-card')).toHaveCount(17);
  await page.screenshot({ path:path.join(output,'gallery-mobile.png'),fullPage:true });
  const overflow=await page.locator('.dlf-root').evaluate(element => element.scrollWidth>element.clientWidth+1);
  assert.equal(overflow,false,'mobile gallery must fit the viewport');
  const original=await manager.call('read',firstImage.id);
  assert.equal(original.favorite,true); assert.equal(original.folderId,folders[1].id);
  assert.deepEqual(original.tags,['浏览器回归','原图']);
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: desktop and mobile gallery, thumbnail endpoint, original image preview, edit, favorite, folder creation, upload, drag/drop, note, search, list, batch move and settings.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await stop(); await manager.close(); await rm(base,{ recursive:true,force:true });
}
