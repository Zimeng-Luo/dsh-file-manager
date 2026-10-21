window.__ModuleLoader__.load({id:"dsh-file-manager",factory:function dshFileManagerClient(require) {
  const React = require('react');
  const h = React.createElement;
  const ID = 'dsh-file-manager';
  const zh = {
    library:'资料库',intro:'保存到这里的资料，可以在其他会话中搜索和读取。',directory:'资料库目录',
    directoryHint:'填写运行 Harness 的机器上的绝对路径。每个目录保留独立资料索引。',saveDirectory:'保存目录',
    setup:'先设置资料库目录，即可上传文件和跨会话使用。',upload:'上传文件',newNote:'新建笔记',
    refresh:'刷新目录',search:'搜索',searchHint:'搜索文件名、标题、标签或正文',all:'全部资料',
    title:'标题',content:'笔记内容',saveNote:'保存笔记',cancel:'取消',busy:'处理中…',
    empty:'暂无资料。上传文件，或在会话中说“把这个文件存入资料库”。',noMatches:'没有找到匹配资料，请尝试其他关键词或刷新目录。',
    preview:'预览',download:'下载原文件',close:'关闭',more:'下一段',previous:'上一页',next:'下一页',total:'资料总数',
    indexed:'正文已索引','metadata-only':'已索引文件名和备注','no-text':'未提取到文字',
    error:'正文解析失败','too-large':'超过正文解析上限',truncated:'正文仅索引了前一部分',
    noPreview:'暂无可预览文字。原文件已保留，可以下载或使用相应工具读取。',saved:'已存入资料库',
    tooLarge:'文件超过上传上限：',fileLimit:'单个文件上限',
  };
  const en = {
    library:'Library',intro:'Save documents here, then find and read them from other conversations.',directory:'Library directory',
    directoryHint:'Use an absolute path on the Harness host. Each directory keeps its own index.',saveDirectory:'Save directory',
    setup:'Choose a library directory to upload files and reuse them across conversations.',upload:'Upload files',newNote:'New note',
    refresh:'Refresh directory',search:'Search',searchHint:'Search filenames, titles, tags or text',all:'All documents',
    title:'Title',content:'Note content',saveNote:'Save note',cancel:'Cancel',busy:'Working…',
    empty:'No documents yet. Upload a file or ask the agent to save one to the library.',noMatches:'No matches. Try other keywords or refresh the directory.',
    preview:'Preview',download:'Download original',close:'Close',more:'Next section',previous:'Previous page',next:'Next page',total:'Documents',
    indexed:'Text indexed','metadata-only':'Filename and metadata indexed','no-text':'No text extracted',
    error:'Text extraction failed','too-large':'Above text extraction limit',truncated:'Only part of the text was indexed',
    noPreview:'No preview text is available. The original is retained for download or suitable file tools.',saved:'Saved to library',
    tooLarge:'File exceeds the upload limit: ',fileLimit:'Per-file limit',
  };
  const css = [
    '.dlf-page{height:100%;overflow:auto;padding:28px;box-sizing:border-box;color:inherit;font:inherit}',
    '.dlf-wrap{max-width:1120px;margin:auto}.dlf-page h1{font-size:26px;margin:0 0 8px}',
    '.dlf-muted{opacity:.65;font-size:13px;overflow-wrap:anywhere}.dlf-box{border:1px solid #8884;border-radius:12px;padding:18px;margin:20px 0}',
    '.dlf-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dlf-grow{flex:1;min-width:180px}',
    '.dlf-page input,.dlf-page textarea{font:inherit;color:inherit;background:transparent;border:1px solid #8886;border-radius:7px;padding:9px;box-sizing:border-box}',
    '.dlf-page textarea{width:100%;min-height:180px;resize:vertical}.dlf-page button{font:inherit;cursor:pointer;color:inherit;background:#8881;border:1px solid #8885;border-radius:7px;padding:8px 12px}',
    '.dlf-page button:disabled{opacity:.45;cursor:default}.dlf-page .dlf-primary{background:#4677d722;border-color:#4677d788}',
    '.dlf-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:12px;margin:18px 0}',
    '.dlf-item{border:1px solid #8884;border-radius:10px;padding:16px;overflow-wrap:anywhere}.dlf-item h3{margin:0 0 8px;font-size:16px}',
    '.dlf-tag{font-size:12px;background:#8882;border-radius:5px;padding:2px 7px;margin-right:5px}',
    '.dlf-preview{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,monospace;max-height:460px;overflow:auto}',
    '.dlf-error{color:#ca4a3e;padding:12px;border:1px solid #ca4a3e55;border-radius:7px;margin:12px 0}',
    '.dlf-label{display:block;margin-bottom:8px}.dlf-gap{margin-top:12px}.dlf-excerpt{font-size:13px;opacity:.8;white-space:pre-wrap}',
    '@media(max-width:600px){.dlf-page{padding:16px}.dlf-items{grid-template-columns:1fr}}',
  ].join('\n');
  const bytesLabel = value => value >= 1048576 ? (value / 1048576).toFixed(1) + ' MiB' : Math.ceil(value / 1024) + ' KiB';
  function encode(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i,i + 32768));
    return btoa(binary);
  }
  function LibraryPage({ api,t }) {
    const [status,setStatus] = React.useState(null);
    const [directory,setDirectory] = React.useState('');
    const [query,setQuery] = React.useState('');
    const [data,setData] = React.useState({ items:[],total:0 });
    const [error,setError] = React.useState('');
    const [notice,setNotice] = React.useState('');
    const [busy,setBusy] = React.useState(false);
    const [noteOpen,setNoteOpen] = React.useState(false);
    const [noteTitle,setNoteTitle] = React.useState('');
    const [noteContent,setNoteContent] = React.useState('');
    const [preview,setPreview] = React.useState(null);
    const picker = React.useRef(null), dirty = React.useRef(false);
    const activeQuery = React.useRef(''), offset = React.useRef(0), generation = React.useRef(0);
    const load = React.useCallback(async signal => {
      const request = ++generation.current;
      try {
        const nextStatus = await api('status',{},signal);
        const nextData = nextStatus.configured ? await api(activeQuery.current ? 'search' : 'list',
          activeQuery.current ? { query:activeQuery.current,limit:30 } : { offset:offset.current,limit:50 },signal) : { items:[],total:0 };
        if (signal?.aborted || request !== generation.current) return;
        setStatus(nextStatus);
        if (!dirty.current) setDirectory(nextStatus.directory);
        setData(nextData);
      } catch (cause) {
        if (!signal?.aborted && request === generation.current) setError(cause.message);
      }
    },[api]);
    React.useEffect(() => {
      const controller = new AbortController();
      void load(controller.signal);
      const timer = setInterval(() => { void load(controller.signal); },status?.pollIntervalMs ?? 5000);
      return () => { controller.abort(); clearInterval(timer); generation.current++; };
    },[load,status?.pollIntervalMs]);
    async function run(operation) {
      setBusy(true); setError(''); setNotice('');
      try { await operation(); }
      catch (cause) { setError(cause.message); }
      finally { await load(); setBusy(false); }
    }
    function upload(event) {
      const selected = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!selected.length) return;
      void run(async () => {
        for (const file of selected) {
          if (file.size > status.maxFileBytes) throw new Error(t('tooLarge') + file.name);
          await api('upload',{ name:file.name,base64:encode(await file.arrayBuffer()) });
          setNotice(t('saved') + ': ' + file.name);
        }
      });
    }
    function download(id) {
      void run(async () => {
        const file = await api('download',{ id });
        const bytes = Uint8Array.from(atob(file.base64),c => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes]));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = file.name;
        document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url),1000);
      });
    }
    const button = (label,props={}) => h('button',{ type:'button',disabled:busy,...props },t(label));
    const entries = data.matches ?? data.items ?? [];
    return h('section',{ className:'dlf-page' },h('style',null,css),h('div',{ className:'dlf-wrap' },
      h('h1',null,t('library')),h('p',{ className:'dlf-muted' },t('intro')),
      h('form',{ className:'dlf-box',onSubmit:event => {
        event.preventDefault(); void run(async () => {
          await api('configure',{ directory }); dirty.current=false; offset.current=0; setPreview(null);
        });
      } },
        h('label',{ htmlFor:'dlf-directory',className:'dlf-label' },t('directory')),
        h('div',{ className:'dlf-row' },
          h('input',{ id:'dlf-directory',className:'dlf-grow',value:directory,placeholder:'F:\\Library',
            onChange:event => { dirty.current=true; setDirectory(event.target.value); } }),
          button('saveDirectory',{ type:'submit',disabled:busy || !directory.trim() })),
        h('p',{ className:'dlf-muted' },t('directoryHint'))),
      status?.initializationError ? h('div',{ role:'alert',className:'dlf-error' },status.initializationError.message) : null,
      error ? h('div',{ role:'alert',className:'dlf-error' },error) : null,
      notice ? h('p',{ role:'status' },notice) : null,
      !status?.configured ? h('p',null,t('setup')) : h(React.Fragment,null,
        h('div',{ className:'dlf-row' },
          button('upload',{ className:'dlf-primary',onClick:() => picker.current.click() }),
          h('input',{ type:'file',ref:picker,multiple:true,hidden:true,onChange:upload }),
          button('newNote',{ onClick:() => setNoteOpen(true) }),
          button(busy ? 'busy' : 'refresh',{ onClick:() => run(async () => {
            const report = await api('refresh',{});
            if (report.errorCount || report.capped) setNotice(JSON.stringify(report));
          }) }),
          h('span',{ className:'dlf-muted' },t('fileLimit') + ': ' + bytesLabel(status.maxFileBytes))),
        noteOpen ? h('form',{ className:'dlf-box',onSubmit:event => {
          event.preventDefault(); void run(async () => {
            await api('note',{ name:'note.md',title:noteTitle || 'note.md',content:noteContent });
            setNoteOpen(false); setNoteTitle(''); setNoteContent(''); setNotice(t('saved'));
          });
        } },
          h('label',{ className:'dlf-label' },t('title'),h('input',{ value:noteTitle,onChange:e => setNoteTitle(e.target.value) })),
          h('label',{ className:'dlf-label' },t('content'),h('textarea',{ value:noteContent,onChange:e => setNoteContent(e.target.value) })),
          h('div',{ className:'dlf-row' },button('saveNote',{ type:'submit' }),button('cancel',{ onClick:() => setNoteOpen(false) }))) : null,
        h('form',{ className:'dlf-row dlf-gap',onSubmit:event => {
          event.preventDefault(); activeQuery.current=query.trim(); offset.current=0; void load();
        } },
          h('input',{ className:'dlf-grow',value:query,'aria-label':t('search'),placeholder:t('searchHint'),onChange:e => setQuery(e.target.value) }),
          button('search',{ type:'submit' }),
          activeQuery.current ? button('all',{ onClick:() => { activeQuery.current=''; offset.current=0; setQuery(''); void load(); } }) : null),
        !entries.length ? h('p',{ className:'dlf-muted' },t(activeQuery.current ? 'noMatches' : 'empty')) : null,
        data.staleCandidates > 0 ? h('p',{ className:'dlf-muted' },data.hint) : null,
        h('div',{ className:'dlf-items' },entries.map(item => h('article',{ className:'dlf-item',key:item.id },
          h('h3',null,item.title),h('div',{ className:'dlf-muted' },item.name + ' · ' + bytesLabel(item.bytes)),
          item.description ? h('p',null,item.description) : null,
          h('p',null,item.tags.map(tag => h('span',{ className:'dlf-tag',key:tag },tag))),
          h('p',{ className:'dlf-muted' },t(item.indexStatus) + (item.textTruncated ? ' · ' + t('truncated') : '')),
          item.excerpt ? h('p',{ className:'dlf-excerpt' },item.excerpt.slice(0,180)) : null,
          h('div',{ className:'dlf-row' },
            button('preview',{ onClick:() => run(async () => setPreview(await api('read',{ id:item.id }))) }),
            button('download',{ onClick:() => download(item.id) }))))),
        !activeQuery.current ? h('div',{ className:'dlf-row' },
          h('span',{ className:'dlf-muted' },t('total') + ': ' + (data.total ?? 0)),
          button('previous',{ disabled:busy || offset.current===0,onClick:() => { offset.current=Math.max(0,offset.current-50); void load(); } }),
          button('next',{ disabled:busy || data.nextOffset==null,onClick:() => { offset.current=data.nextOffset; void load(); } })) : null,
        preview ? h('aside',{ className:'dlf-box' },
          h('div',{ className:'dlf-row' },h('h2',{ className:'dlf-grow' },preview.title),button('close',{ onClick:() => setPreview(null) })),
          h('p',{ className:'dlf-muted' },preview.path),
          h('pre',{ className:'dlf-preview' },preview.text || t('noPreview')),
          preview.indexError ? h('p',{ className:'dlf-error' },preview.indexError) : null,
          preview.nextOffset!=null ? button('more',{ onClick:() => run(async () => setPreview(await api('read',{ id:preview.id,offset:preview.nextOffset }))) }) : null) : null)));
  }
  function LibraryIcon({ size=16 }) {
    return h('svg',{ width:size,height:size,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor','aria-hidden':true },
      h('path',{ d:'M2 2.5h3v11H2zM7 2.5h3v11H7zM11 3.5l2-.5 2.5 10-2 .5z' }));
  }
  function apply(ctx) {
    ctx.effect(() => ctx.locale.register(ID,{ zh,en }),'library: dictionaries');
    const t = ctx.locale.bind(ID);
    const api = async (method,payload={},signal) => {
      const result = await ctx.connection.rpc.call('/api',ID,{ method,payload },signal);
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    };
    ctx.inject(['layout'],pageCtx => pageCtx.slots.inject('main',() => {
      const stopPage = pageCtx.slots.register({ name:'main',key:ID,locale:ID,inject:() => ({ api,t }) },LibraryPage);
      const stopSidebar = pageCtx.slots.inject('sidebar.panellist',() => pageCtx.slots.register({
        name:'sidebar.panellist',id:ID,order:30,label:() => t('library'),locale:ID,
      },LibraryIcon));
      return () => { stopSidebar(); stopPage(); };
    }));
  }
  return { name:'dsh-file-manager-client',inject:['slots','connection','locale'],apply,LibraryPage };
}});
