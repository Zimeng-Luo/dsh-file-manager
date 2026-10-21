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
  if (method === 'list') { exact(payload,['offset','limit']); return manager.call('list',payload); }
  if (method === 'search') { exact(payload,['query','limit']); return manager.call('search',payload.query,payload.limit); }
  if (method === 'read') { exact(payload,['id','offset','limit']); const { id,...options } = payload; return manager.call('read',id,options); }
  if (method === 'refresh') { exact(payload,[]); return manager.call('refresh'); }
  if (method === 'download') { exact(payload,['id']); return manager.call('download',payload.id); }
  if (method === 'upload' || method === 'note') {
    exact(payload,method === 'upload' ? ['name','base64','title','description','tags'] : ['name','content','title','description','tags']);
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
      description: payload.description,tags: payload.tags,source: method === 'note' ? 'note' : 'browser-upload' });
  }
  throw new LibraryError('bad-request','Unknown library operation.');
}

/** Harness authenticates this exact route and enforces owner-peer access. */
export function installLibraryRpc(ctx,manager) {
  return ctx.connection.fetch.register({
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
}
