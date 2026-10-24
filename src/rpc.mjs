import { LibraryError,validateMetadata } from './library.mjs';

export const RPC_METHOD = 'dsh-file-manager';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function exact(payload,allowed) {
  if (!record(payload) || Object.keys(payload).some(key => !allowed.includes(key))) throw new LibraryError('bad-request','Invalid request fields.');
}

/** Browser and model operations share the same storage manager. */
export async function dispatch(manager,method,payload) {
  if (method === 'status') { exact(payload,[]); return manager.status(); }
  if (method === 'configure') { exact(payload,['directory']); return manager.configure(payload.directory); }
  if (method === 'browse') { exact(payload,['query','offset','limit','folderId','kind','favorite','sort']); return manager.call('browse',payload); }
  if (method === 'folders') { exact(payload,[]); return manager.call('folders'); }
  if (method === 'createFolder') { exact(payload,['name','parentId']); return manager.call('createFolder',payload); }
  if (method === 'renameFolder') { exact(payload,['id','name']); return manager.call('renameFolder',payload); }
  if (method === 'removeFolder') { exact(payload,['id']); return manager.call('removeFolder',payload); }
  if (method === 'update') { exact(payload,['id','title','description','tags','folderId','favorite']); return manager.call('update',payload); }
  if (method === 'list') { exact(payload,['offset','limit']); return manager.call('list',payload); }
  if (method === 'search') { exact(payload,['query','limit']); return manager.call('search',payload.query,payload.limit); }
  if (method === 'read') { exact(payload,['id','offset','limit']); const { id,...options } = payload; return manager.call('read',id,options); }
  if (method === 'refresh') { exact(payload,[]); return manager.call('refresh'); }
  if (method === 'download') { exact(payload,['id']); return manager.call('download',payload.id); }
  if (method === 'upload' || method === 'note') {
    exact(payload,method === 'upload' ? ['name','base64','title','description','tags','folderId','favorite'] : ['name','content','title','description','tags','folderId','favorite']);
    validateMetadata(payload);
    const { maxFileBytes } = await manager.status();
    let bytes;
    if (method === 'upload') {
      if (typeof payload.base64 !== 'string' || payload.base64.length > Math.ceil(maxFileBytes / 3) * 4
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.base64)) {
        throw new LibraryError('invalid-upload','Invalid or oversized base64 file.');
      }
      bytes = Buffer.from(payload.base64,'base64');
    } else {
      if (typeof payload.content !== 'string' || Buffer.byteLength(payload.content,'utf8') > maxFileBytes) throw new LibraryError('invalid-note','Missing or oversized text.');
      bytes = Buffer.from(payload.content,'utf8');
    }
    return manager.call('store', { bytes,name: payload.name ?? 'note.md',title: payload.title,
      description: payload.description,tags: payload.tags,folderId:payload.folderId,favorite:payload.favorite,source: method === 'note' ? 'note' : 'browser-upload' });
  }
  throw new LibraryError('bad-request','Unknown library operation.');
}

/** Harness authenticates this exact route and enforces owner-peer access. */
export function installLibraryRpc(ctx,manager) {
  const stopRpc = ctx.connection.fetch.register({
    path: '/api/' + RPC_METHOD,methods: ['POST'],requestBody: 'buffered',
    async fetch(request) {
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return new Response('Expected application/json',{ status: 415 });
      let envelope;
      try { envelope = await request.json(); }
      catch { return new Response('Invalid JSON',{ status: 400 }); }
      if (!record(envelope) || envelope.type !== 'client-request' || typeof envelope.rpcId !== 'string'
        || envelope.method !== RPC_METHOD || !record(envelope.payload) || typeof envelope.payload.method !== 'string' || !record(envelope.payload.payload)) {
        return new Response('Invalid RPC envelope',{ status: 400 });
      }
      let result;
      try {
        request.signal.throwIfAborted();
        result = { ok: true,value: await dispatch(manager,envelope.payload.method,envelope.payload.payload) };
      } catch (error) {
        result = { ok: false,error: { code: error.code ?? 'library-operation-failed',message: error.message ?? 'Library operation failed.',details: {} } };
      }
      return Response.json({ type: 'server-response',rpcId: envelope.rpcId,result });
    },
  });
  const cache = new Map();
  let cachedBytes = 0;
  const stopAsset = ctx.connection.fetch.register({
    path:'/api/' + RPC_METHOD + '/asset',methods:['GET'],requestBody:'buffered',
    async fetch(request) {
      const url = new URL(request.url),id = url.searchParams.get('id');
      try {
        request.signal.throwIfAborted();
        const asset = await manager.call('asset',id);
        let bytes = asset.bytes,mime = 'application/octet-stream';
        const thumbnail = url.searchParams.get('thumbnail') === '1';
        if (thumbnail) {
          if (asset.kind !== 'image') throw new LibraryError('unsupported-preview','No image thumbnail is available.');
          const key = asset.sha256;
          const cached = cache.get(key);
          if (cached) { cache.delete(key); cache.set(key,cached); bytes = cached; }
          else {
            const { default:sharp } = await import('sharp');
            bytes = await sharp(bytes,{ limitInputPixels:64000000,animated:false }).rotate().resize({ width:480,height:640,fit:'inside',withoutEnlargement:true }).webp({ quality:76 }).toBuffer();
            if (bytes.length <= 4 * 1024 * 1024) {
              const previous=cache.get(key); if (previous) cachedBytes -= previous.length;
              cache.set(key,bytes); cachedBytes += bytes.length;
              while (cache.size > 128 || cachedBytes > 32 * 1024 * 1024) {
                const oldest = cache.keys().next().value; cachedBytes -= cache.get(oldest).length; cache.delete(oldest);
              }
            }
          }
          mime = 'image/webp';
        } else {
          const ext = asset.name.toLowerCase().split('.').pop();
          mime = ({ png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',tif:'image/tiff',tiff:'image/tiff',pdf:'application/pdf' })[ext] ?? mime;
        }
        const download = url.searchParams.get('download') === '1' || mime === 'application/octet-stream';
        const headers = {
          'content-type':mime,'content-length':String(bytes.length),'x-content-type-options':'nosniff',
          'cache-control':url.searchParams.get('v') === asset.sha256 ? 'private, max-age=3600' : 'private, no-store',
          'cross-origin-resource-policy':'same-origin',
          'content-security-policy':"default-src 'none'; sandbox",
          'content-disposition':(download ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(asset.name).replace(/['()]/g,character => '%' + character.charCodeAt(0).toString(16).toUpperCase()),
        };
        request.signal.throwIfAborted();
        return new Response(bytes,{ headers });
      } catch (error) {
        const status = ['not-found','ENOENT'].includes(error.code) ? 404 : error.code === 'file-too-large' ? 413 : error.code === 'unsupported-preview' ? 415 : error.code === 'unsafe-path' ? 403 : 400;
        return Response.json({ error:{ code:error.code ?? 'preview-failed',message:error.message } },{ status,headers:{ 'cache-control':'no-store' } });
      }
    },
  });
  return async () => { cache.clear(); cachedBytes=0; await Promise.all([stopAsset(),stopRpc()]); };
}
