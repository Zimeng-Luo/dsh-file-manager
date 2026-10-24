module.exports = function dshFileManagerClient(require) {
  const React = require('react'), h = React.createElement, ID = 'dsh-file-manager';
  const zh = {
    library:'资料库',all:'全部',recommended:'推荐',favorites:'收藏',folders:'文件夹',images:'图像',items:'项目',
    search:'搜索资料库',new:'新建',upload:'上传文件',newNote:'新建笔记',newFolder:'新建文件夹',settings:'资料库设置',
    grid:'网格视图',listView:'列表视图',recent:'最近添加',oldest:'最早添加',name:'名称',size:'文件大小',recommendedSort:'收藏与最近',
    directory:'资料库目录',directoryHint:'填写运行 Harness 的机器上的绝对路径。',saveDirectory:'保存目录',
    setup:'设置一个资料库目录，开始保存和整理你的资料。',intro:'将文件留在这里，在任何会话里继续使用。',
    title:'标题',description:'备注',tags:'标签',tagsHint:'用逗号分隔标签',content:'笔记内容',saveNote:'保存笔记',
    save:'保存',cancel:'取消',close:'关闭',busy:'处理中…',empty:'资料库还是空的',emptyHint:'拖放文件到这里，或点击「新建」上传。也可以让模型把文件存入资料库。',
    noMatches:'没有找到相关资料',noMatchesHint:'试试其他关键词，或切换分类。',emptyFavorites:'还没有收藏',emptyFavoritesHint:'点击文件卡片上的星标，将常用资料放到这里。',
    emptyFolders:'创建第一个文件夹',emptyFoldersHint:'按项目或用途整理资料，也可以让模型帮你分类。',
    refresh:'刷新目录',refreshHint:'登记手动放入目录的文件',download:'下载原文件',preview:'预览',edit:'编辑资料',
    favorite:'收藏',unfavorite:'取消收藏',folder:'所在文件夹',unfiled:'未分类',editFolder:'编辑文件夹',removeFolder:'移除文件夹',
    removeFolderHint:'移除后，其中的资料和子文件夹移到上一级，原文件保留。',folderName:'文件夹名称',parentFolder:'上级文件夹',topLevel:'顶层',
    previous:'上一页',next:'下一页',more:'继续读取',selected:'已选择',clearSelection:'取消选择',move:'移动到文件夹',chooseFolder:'选择目标文件夹',
    selectItem:'选择资料',saved:'已保存',dropped:'松开即可上传',uploading:'正在上传',tooLarge:'文件超过上传上限：',total:'项',
    documents:'文档',notes:'笔记',type:'类型',date:'添加时间',originalPath:'原件路径',copyPath:'复制路径',copied:'路径已复制',
    'metadata-only':'已保留原文件，支持名称和标签搜索',indexed:'正文已索引','no-text':'未提取到文字',error:'正文解析失败','too-large':'超过正文解析上限',
    noPreview:'此文件暂不支持正文预览，可以下载原文件查看。',truncated:'正文仅索引了前一部分',fileLimit:'单个文件上限',
    textPreview:'提取的正文',image:'图像',pdf:'PDF',document:'文档',spreadsheet:'表格',presentation:'演示文稿',note:'笔记',file:'文件',
  };
  const en = {
    library:'Library',all:'All',recommended:'Suggested',favorites:'Favorites',folders:'Folders',images:'Images',items:'Items',
    search:'Search library',new:'New',upload:'Upload files',newNote:'New note',newFolder:'New folder',settings:'Library settings',
    grid:'Grid view',listView:'List view',recent:'Recently added',oldest:'Oldest first',name:'Name',size:'File size',recommendedSort:'Favorites and recent',
    directory:'Library directory',directoryHint:'Use an absolute path on the Harness host.',saveDirectory:'Save directory',
    setup:'Choose a library directory to start saving and organizing.',intro:'Keep files here and use them in any conversation.',
    title:'Title',description:'Description',tags:'Tags',tagsHint:'Separate tags with commas',content:'Note content',saveNote:'Save note',
    save:'Save',cancel:'Cancel',close:'Close',busy:'Working…',empty:'Your library is empty',emptyHint:'Drop files here or choose New to upload. You can also ask your agent to save a file.',
    noMatches:'No matching items',noMatchesHint:'Try other keywords or a different category.',emptyFavorites:'No favorites yet',emptyFavoritesHint:'Star a file to keep it close.',
    emptyFolders:'Create your first folder',emptyFoldersHint:'Organize by project or purpose, or ask your agent to help.',
    refresh:'Refresh directory',refreshHint:'Discover manually copied files',download:'Download original',preview:'Preview',edit:'Edit item',
    favorite:'Favorite',unfavorite:'Unfavorite',folder:'Folder',unfiled:'Unfiled',editFolder:'Edit folder',removeFolder:'Remove folder',
    removeFolderHint:'Items and child folders move to the parent. Original files are retained.',folderName:'Folder name',parentFolder:'Parent folder',topLevel:'Top level',
    previous:'Previous',next:'Next',more:'Read more',selected:'Selected',clearSelection:'Clear selection',move:'Move to folder',chooseFolder:'Choose a destination',
    selectItem:'Select item',saved:'Saved',dropped:'Drop to upload',uploading:'Uploading',tooLarge:'File exceeds upload limit: ',total:'items',
    documents:'Documents',notes:'Notes',type:'Type',date:'Added',originalPath:'Original path',copyPath:'Copy path',copied:'Path copied',
    'metadata-only':'Original retained; searchable by name and tags',indexed:'Text indexed','no-text':'No text extracted',error:'Text extraction failed','too-large':'Above extraction limit',
    noPreview:'Text preview is unavailable. Download the original to view it.',truncated:'Only part of the text was indexed',fileLimit:'Per-file limit',
    textPreview:'Extracted text',image:'Image',pdf:'PDF',document:'Document',spreadsheet:'Spreadsheet',presentation:'Presentation',note:'Note',file:'File',
  };
  const paths = {
    folder:'M3 6h6l2 2h10v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 4h18',
    grid:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    list:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    plus:'M12 5v14M5 12h14',close:'M6 6l12 12M6 18 18 6',chevron:'m8 5 7 7-7 7',down:'m6 9 6 6 6-6',
    star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
    settings:'M4 7h16M4 17h16M8 4v6M16 14v6',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
    note:'M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h5',
    file:'M5 3h9l5 5v13H5V3Zm9 0v6h5',image:'M3 4h18v16H3V4Zm0 12 6-6 5 5 3-3 4 4M16 8h.01',
    refresh:'M20 7a9 9 0 1 0 1 9M20 3v5h-5',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    check:'m5 12 4 4L20 5',edit:'m15 4 5 5-11 11H4v-5L15 4Z',dots:'M5 12h.01M12 12h.01M19 12h.01',
  };
  function Icon({ name='file',size=20 }) {
    return h('svg',{ width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true },h('path',{ d:paths[name] ?? paths.file }));
  }
  const css = [
    '.dlf-root{--lf-bg:#09090b;--lf-card:#1b1b1e;--lf-hover:#242429;--lf-line:#ffffff14;--lf-muted:#909096;--lf-text:#ededf0;height:100%;overflow:auto;background:var(--lf-bg);color:var(--lf-text);font-family:inherit;font-size:14px;line-height:1.5;position:relative;isolation:isolate;color-scheme:dark}',
    '.dlf-root *{box-sizing:border-box}.dlf-wrap{max-width:1620px;margin:auto;padding:34px 44px 60px}.dlf-root button,.dlf-root input,.dlf-root select,.dlf-root textarea{font:inherit}.dlf-root button{cursor:pointer;color:inherit;border:0;background:none}.dlf-root button:disabled{opacity:.42;cursor:default}.dlf-root button:focus-visible,.dlf-root input:focus-visible,.dlf-root select:focus-visible,.dlf-root textarea:focus-visible{outline:2px solid #a6b8ff;outline-offset:3px}',
    '.dlf-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}.dlf-head h1{font-size:27px;letter-spacing:-.7px;margin:0;font-weight:650}.dlf-toolbar,.dlf-row{display:flex;align-items:center;gap:10px}.dlf-toolbar{flex-wrap:wrap;justify-content:flex-end}.dlf-icon{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.dlf-icon:hover,.dlf-icon[aria-pressed=true]{background:#ffffff12}.dlf-toggle{display:flex;gap:3px}.dlf-search{display:flex;align-items:center;gap:9px;border:1px solid var(--lf-line);border-radius:22px;padding:8px 13px;width:270px;color:var(--lf-muted)}.dlf-search input{border:0!important;padding:0!important;background:none!important;outline:none!important;min-width:0;width:100%;color:var(--lf-text)}',
    '.dlf-root .dlf-primary{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:22px;padding:9px 16px;background:#f1f1f3;color:#141416;font-weight:550}.dlf-secondary{border:1px solid var(--lf-line)!important;border-radius:10px;padding:8px 13px!important}.dlf-secondary:hover{background:var(--lf-hover)}.dlf-root .dlf-danger{color:#ffa39e}.dlf-tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:30px}.dlf-tab{padding:8px 16px;border-radius:22px;color:var(--lf-muted)!important}.dlf-tab[aria-selected=true]{background:#242428;color:#f5f5f7!important}.dlf-tab:hover{color:#fff!important}.dlf-breadcrumbs{display:flex;align-items:center;gap:6px;color:var(--lf-muted);margin:0 0 24px;flex-wrap:wrap}.dlf-breadcrumbs button{color:inherit}.dlf-breadcrumbs button:hover{color:white}.dlf-breadcrumbs span{color:var(--lf-text)}',
    '.dlf-section{margin:26px 0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}.dlf-section h2{font-size:17px;font-weight:550;margin:0}.dlf-count,.dlf-muted{font-size:12px;color:var(--lf-muted)}.dlf-sort{border:0!important;padding:6px 8px!important;background:transparent!important;color:var(--lf-muted)!important;font-size:12px!important;max-width:150px}.dlf-root select option{background:#222225;color:white}',
    '.dlf-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}.dlf-folder{border-radius:17px!important;background:var(--lf-card)!important;overflow:hidden;text-align:left;min-height:162px;padding:0!important;transition:background .15s,transform .15s}.dlf-folder:hover{background:var(--lf-hover)!important;transform:translateY(-2px)}.dlf-folder-head{display:flex;align-items:center;gap:9px;padding:14px 16px;border-bottom:1px solid #ffffff05}.dlf-ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.dlf-folder-head .dlf-count{margin-left:auto}.dlf-folder-cover{height:108px;display:flex;align-items:center;justify-content:center;color:#b2b2b8;position:relative}.dlf-folder-stack{position:relative;width:94px;height:78px}.dlf-folder-stack img{position:absolute;width:65px;height:77px;object-fit:cover;border-radius:6px;box-shadow:0 5px 14px #0006;background:#303035;left:14px;top:0}.dlf-folder-stack img:nth-child(1){transform:rotate(-9deg);left:6px}.dlf-folder-stack img:nth-child(2){transform:rotate(8deg);left:22px}.dlf-folder-stack img:last-child{transform:none;left:14px}',
    '.dlf-masonry{display:grid;grid-template-columns:repeat(var(--lf-columns),minmax(0,1fr));gap:16px;align-items:start}.dlf-masonry-column{min-width:0}.dlf-gallery{columns:5 210px;column-gap:16px}.dlf-card{display:inline-block;width:100%;break-inside:avoid;margin-bottom:16px;background:var(--lf-card);border:1px solid #ffffff04;border-radius:17px;overflow:hidden;position:relative;vertical-align:top;transition:border .15s}.dlf-card:hover{border-color:#ffffff30}.dlf-card.selected{border-color:#9cb0ff}.dlf-cover{display:block;width:100%;padding:0!important;text-align:left;position:relative;min-height:150px}.dlf-image{display:block;width:100%;height:auto;min-height:130px;max-height:430px;object-fit:cover;background:#18181b}.dlf-document-cover{height:238px;display:flex;align-items:center;justify-content:center}.dlf-document-symbol{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;letter-spacing:.5px;font-weight:650}.dlf-kind-pdf{color:#ff5757}.dlf-kind-document,.dlf-kind-note{color:#4b9dff}.dlf-kind-spreadsheet{color:#57c69a}.dlf-kind-presentation{color:#f9ac70}.dlf-kind-file{color:#a4a4b1}',
    '.dlf-card-caption{padding:12px 14px 13px}.dlf-card-title{font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;margin-bottom:3px}.dlf-card-title>span{flex:1}.dlf-card-sub{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--lf-muted)}.dlf-card-actions{position:absolute;left:9px;right:9px;top:9px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}.dlf-card-actions>*{pointer-events:auto}.dlf-card-actions .dlf-icon{background:#161619bd;backdrop-filter:blur(8px);width:30px;height:30px;opacity:0;transition:opacity .15s}.dlf-card:hover .dlf-card-actions .dlf-icon,.dlf-card:focus-within .dlf-card-actions .dlf-icon,.dlf-card.selected .dlf-icon,.dlf-card .dlf-icon.is-favorite{opacity:1}.dlf-card .is-favorite{color:#edcd83}.dlf-select{appearance:none;width:18px;height:18px;border:1px solid #ffffff70!important;border-radius:5px;background:#16161988!important;padding:0!important;cursor:pointer;opacity:0}.dlf-card:hover .dlf-select,.dlf-card:focus-within .dlf-select,.dlf-select:checked{opacity:1}.dlf-select:checked{background:#a5b7ff!important;border-color:#a5b7ff!important}.dlf-select:checked:after{content:"✓";display:block;color:#141416;font:13px/16px sans-serif;text-align:center}',
    '.dlf-table{width:100%;border-collapse:collapse;table-layout:fixed}.dlf-table th{text-align:left;color:var(--lf-muted);font-size:12px;font-weight:400;padding:12px 10px;border-bottom:1px solid var(--lf-line)}.dlf-table td{padding:11px 10px;border-bottom:1px solid #ffffff08;font-size:13px}.dlf-table tr:hover td{background:#ffffff04}.dlf-table .dlf-select{opacity:1}.dlf-table-title{display:flex;align-items:center;gap:12px;max-width:100%;text-align:left}.dlf-table-thumb{width:40px;height:44px;object-fit:cover;border-radius:5px;flex-shrink:0}.dlf-table .dlf-icon.is-favorite{color:#edcd83}.dlf-table th:first-child{width:38px}.dlf-table th:nth-child(3){width:16%}.dlf-table th:nth-child(4){width:90px}.dlf-table th:nth-child(5){width:95px}.dlf-table th:last-child{width:50px}',
    '.dlf-empty{text-align:center;padding:70px 24px;color:var(--lf-muted);border:1px dashed var(--lf-line);border-radius:18px}.dlf-empty svg{opacity:.45;margin-bottom:12px}.dlf-empty h3{font-size:17px;font-weight:500;color:var(--lf-text);margin:0 0 8px}.dlf-empty p{max-width:420px;margin:0 auto 20px;font-size:13px}.dlf-pager{display:flex;justify-content:center;align-items:center;gap:20px;margin-top:24px}.dlf-error{border:1px solid #e2736c55;background:#e2736c0d;border-radius:10px;color:#ffb1ac;padding:12px 16px;margin:16px 0;white-space:pre-wrap}.dlf-notice{color:#afc9b4;font-size:13px;margin:12px 0}.dlf-batch{background:#202027;border:1px solid #ffffff16;border-radius:12px;padding:9px 14px;margin-bottom:18px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.dlf-batch strong{margin-right:auto;font-size:13px}.dlf-progress{padding:10px 0;color:var(--lf-muted);font-size:12px}.dlf-progress progress{width:160px;accent-color:#afbfff;margin-right:10px}',
    '.dlf-new-wrap{position:relative}.dlf-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:188px;background:#242428;border:1px solid #ffffff15;border-radius:13px;padding:6px;box-shadow:0 16px 60px #0008;z-index:15}.dlf-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px;border-radius:8px;white-space:nowrap}.dlf-menu button:hover{background:#ffffff0c}.dlf-drop{position:fixed;inset:12px;z-index:80;background:#16161eea;border:2px dashed #9cafff;border-radius:24px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;font-size:24px;pointer-events:none}',
    '.dlf-backdrop{position:fixed;inset:0;background:#000a;backdrop-filter:blur(8px);z-index:70;display:flex;align-items:center;justify-content:center;padding:28px}.dlf-dialog{background:#17171b;border:1px solid #ffffff1a;border-radius:20px;box-shadow:0 30px 100px #000a;width:min(540px,100%);max-height:90vh;overflow:auto;padding:24px;color:var(--lf-text)}.dlf-dialog.wide{width:min(1160px,100%)}.dlf-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}.dlf-dialog-head h2{font-size:18px;font-weight:550;margin:0;overflow-wrap:anywhere}.dlf-dialog label{display:block;font-size:12px;color:#aaaab3;margin:14px 0 6px}.dlf-root input:not([type=checkbox]),.dlf-root select,.dlf-root textarea{background:#111114;color:inherit;border:1px solid #ffffff1c;border-radius:9px;padding:10px 12px;min-width:0}.dlf-dialog input:not([type=checkbox]),.dlf-dialog select,.dlf-dialog textarea{width:100%}.dlf-dialog textarea{resize:vertical;min-height:120px}.dlf-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:22px}.dlf-preview-grid{display:grid;grid-template-columns:minmax(0,1fr) 265px;gap:26px}.dlf-preview-media{min-width:0;background:#101013;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:center;min-height:320px;overflow:auto}.dlf-preview-media img{max-width:100%;max-height:67vh;object-fit:contain;display:block}.dlf-preview-media iframe{width:100%;height:63vh;border:0}.dlf-preview-text{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 ui-monospace,monospace;align-self:start;width:100%;margin:0;max-height:65vh;overflow:auto}.dlf-details{min-width:0}.dlf-details .dlf-muted{overflow-wrap:anywhere}.dlf-tags{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}.dlf-tag{font-size:11px;color:#bfc4d7;background:#ffffff0a;border-radius:5px;padding:3px 7px}.dlf-path{word-break:break-all;font-size:11px;color:var(--lf-muted);line-height:1.7}.dlf-empty .dlf-settings-body{max-width:430px;margin:24px auto 0;text-align:left}.dlf-settings-body input{width:100%}.dlf-settings-body p{color:var(--lf-muted);font-size:13px}.dlf-loading{height:238px;border-radius:17px;background:linear-gradient(110deg,#17171b 25%,#242429 45%,#17171b 65%);background-size:250% 100%;animation:lf-load 1.5s linear infinite}@keyframes lf-load{to{background-position:-150% 0}}',
    '@media(min-width:1450px){.dlf-gallery{column-count:6}}@media(max-width:1050px){.dlf-wrap{padding:26px}.dlf-head{align-items:flex-start}.dlf-search{width:220px}.dlf-preview-grid{grid-template-columns:minmax(0,1fr) 230px}}@media(max-width:720px){.dlf-wrap{padding:20px 16px}.dlf-head{flex-direction:column;gap:16px}.dlf-toolbar{width:100%;justify-content:flex-start;gap:6px}.dlf-search{flex:1;width:130px}.dlf-toggle{order:2}.dlf-tabs{gap:2px;margin-bottom:22px}.dlf-tab{padding:8px 12px}.dlf-folders{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dlf-folder-head{padding:11px;font-size:12px}.dlf-folder-cover{height:88px}.dlf-folder{min-height:135px}.dlf-gallery{columns:2;column-gap:10px}.dlf-masonry{gap:10px}.dlf-card{margin-bottom:10px;border-radius:13px}.dlf-card-caption{padding:9px}.dlf-card-actions .dlf-icon,.dlf-card-actions .dlf-select{opacity:1}.dlf-document-cover{height:185px}.dlf-backdrop{padding:10px}.dlf-dialog{padding:18px;max-height:95vh;border-radius:15px}.dlf-preview-grid{grid-template-columns:1fr}.dlf-preview-media{min-height:220px}.dlf-preview-media img{max-height:55vh}.dlf-table th:nth-child(3),.dlf-table td:nth-child(3),.dlf-table th:nth-child(4),.dlf-table td:nth-child(4){display:none}.dlf-table th:nth-child(5){width:75px}}',
    '@media(prefers-reduced-motion:reduce){.dlf-root *{animation:none!important;transition:none!important}}',
  ].join('\n');
  const bytesLabel = value => value >= 1048576 ? (value / 1048576).toFixed(1) + ' MB' : Math.max(1,Math.ceil(value / 1024)) + ' KB';
  const assetUrl = (item,thumbnail=false,download=false) => 'api/' + ID + '/asset?id=' + encodeURIComponent(item.id) + '&v=' + encodeURIComponent(item.sha256 ?? '') + (thumbnail ? '&thumbnail=1' : '') + (download ? '&download=1' : '');
  const dateLabel = value => value ? new Date(value).toLocaleDateString() : '';
  const kindOf = item => item.kind ?? (/\.(png|jpe?g|gif|webp|avif)$/i.test(item.name ?? '') ? 'image' : item.source === 'note' ? 'note' : 'file');
  function Image({ item,thumbnail=true,className,alt='' }) {
    const [failed,setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false),[item.id,item.sha256]);
    return failed ? h('span',{ className:'dlf-document-cover dlf-kind-file' },h(Icon,{ name:'image',size:42 })) :
      h('img',{ className,src:assetUrl(item,thumbnail),alt,loading:thumbnail ? 'lazy' : 'eager',decoding:'async',onError:() => setFailed(true) });
  }

  function Masonry({ items,render }) {
    const ref=React.useRef(null),[columns,setColumns]=React.useState(6);
    React.useEffect(() => {
      if (!ref.current || typeof ResizeObserver === 'undefined') return;
      const observer=new ResizeObserver(entries => {
        const width=entries[0].contentRect.width;
        setColumns(Math.max(2,Math.min(6,Math.floor((width + 16) / 226))));
      });
      observer.observe(ref.current);
      return () => observer.disconnect();
    },[]);
    return h('div',{ ref,className:'dlf-masonry',style:{ '--lf-columns':columns } },Array.from({ length:columns },(_,column) =>
      h('div',{ className:'dlf-masonry-column',key:column },items.filter((_,index) => index % columns === column).map(render))));
  }

  function Dialog({ title,onClose,wide=false,children,t }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (typeof document === 'undefined') return;
      const previous = document.activeElement;
      const first = ref.current?.querySelector('button,input,textarea,select');
      first?.focus();
      return () => previous?.focus?.();
    },[]);
    function keyDown(event) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(ref.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') ?? []);
      if (!nodes.length || typeof document === 'undefined') return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
    }
    return h('div',{ className:'dlf-backdrop',onMouseDown:event => { if (event.target === event.currentTarget) onClose(); } },
      h('div',{ className:'dlf-dialog' + (wide ? ' wide' : ''),role:'dialog','aria-modal':true,'aria-label':title,ref,onKeyDown:keyDown },
        h('div',{ className:'dlf-dialog-head' },h('h2',null,title),h('button',{ type:'button',className:'dlf-icon','aria-label':t('close'),onClick:onClose },h(Icon,{ name:'close' }))),children));
  }
  function LibraryPage({ api,t }) {
    const [status,setStatus] = React.useState(null), [directory,setDirectory] = React.useState('');
    const [tab,setTab] = React.useState('all'), [folderId,setFolderId] = React.useState(undefined);
    const [folders,setFolders] = React.useState([]), [query,setQuery] = React.useState(''), [search,setSearch] = React.useState('');
    const [sort,setSort] = React.useState('recent'), [offset,setOffset] = React.useState(0);
    const [data,setData] = React.useState({ items:[],total:0 }), [error,setError] = React.useState(''), [notice,setNotice] = React.useState('');
    const [busy,setBusy] = React.useState(false), [loading,setLoading] = React.useState(true), [menu,setMenu] = React.useState(false);
    const [settings,setSettings] = React.useState(false), [noteOpen,setNoteOpen] = React.useState(false);
    const [noteTitle,setNoteTitle] = React.useState(''), [noteContent,setNoteContent] = React.useState(''), [noteTags,setNoteTags] = React.useState('');
    const [folderEdit,setFolderEdit] = React.useState(null), [folderName,setFolderName] = React.useState('');
    const [preview,setPreview] = React.useState(null), [details,setDetails] = React.useState(null), [previewError,setPreviewError] = React.useState('');
    const [textMode,setTextMode] = React.useState(false);
    const [editOpen,setEditOpen] = React.useState(false), [editTitle,setEditTitle] = React.useState(''), [editDescription,setEditDescription] = React.useState(''), [editTags,setEditTags] = React.useState(''), [editFolder,setEditFolder] = React.useState('');
    const [selected,setSelected] = React.useState([]), [moveOpen,setMoveOpen] = React.useState(false), [destination,setDestination] = React.useState('');
    const [dragging,setDragging] = React.useState(false), [progress,setProgress] = React.useState(null);
    const [view,setView] = React.useState(() => { try { return localStorage.getItem(ID + ':view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } });
    const picker = React.useRef(null), dirty = React.useRef(false), generation = React.useRef(0), dragDepth = React.useRef(0), transportError = React.useRef('');
    const current = folders.find(folder => folder.id === folderId);
    const tags = value => value.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean);
    const labelFolder = id => {
      const chain = [],seen = new Set(); let folder = folders.find(value => value.id === id);
      while (folder && !seen.has(folder.id)) { seen.add(folder.id); chain.unshift(folder.name); folder = folders.find(value => value.id === folder.parentId); }
      return chain.join(' / ') || t('unfiled');
    };
    const load = React.useCallback(async signal => {
      const request = ++generation.current;
      try {
        const nextStatus = await api('status',{},signal);
        let result = { items:[],total:0 },group = { folders:[] };
        if (nextStatus.configured) {
          const filters = { offset,limit:60,sort,query:search };
          if (folderId !== undefined) filters.folderId = folderId;
          if (tab === 'favorites') filters.favorite = true;
          if (tab === 'images') filters.kind = 'images';
          [result,group] = await Promise.all([api('browse',filters,signal),api('folders',{},signal)]);
        }
        if (signal?.aborted || request !== generation.current) return;
        setStatus(nextStatus); if (!dirty.current) setDirectory(nextStatus.directory);
        setData(result); setFolders(group.folders); setLoading(false);
        setError(previous => previous === transportError.current ? '' : previous); transportError.current='';
      } catch (cause) { if (!signal?.aborted && request === generation.current) { transportError.current=cause.message; setError(cause.message); setLoading(false); if (/folder.*not found/i.test(cause.message)) setFolderId(undefined); } }
    },[api,offset,sort,tab,folderId,search]);
    React.useEffect(() => {
      const controller = new AbortController(); void load(controller.signal);
      const timer = setInterval(() => { void load(controller.signal); },status?.pollIntervalMs ?? 5000);
      return () => { controller.abort(); clearInterval(timer); generation.current++; };
    },[load,status?.pollIntervalMs]);
    React.useEffect(() => {
      const timer = setTimeout(() => { setSearch(query); setOffset(0); },280);
      return () => clearTimeout(timer);
    },[query]);
    React.useEffect(() => {
      if (!preview) { setDetails(null); return; }
      const controller = new AbortController(); setDetails(null); setPreviewError(''); setTextMode(false);
      api('read',{ id:preview.id },controller.signal).then(value => { if (!controller.signal.aborted) setDetails(value); }).catch(cause => { if (!controller.signal.aborted) setPreviewError(cause.message); });
      return () => controller.abort();
    },[api,preview?.id]);
    async function run(operation) {
      setBusy(true); transportError.current=''; setError(''); setNotice('');
      try { await operation(); }
      catch (cause) { setError(cause.message); }
      finally { await load(); setBusy(false); }
    }
    function changeTab(value) { setTab(value); setMenu(false); if (value === 'recommended') setSort('recommended'); else if (sort === 'recommended') setSort('recent'); setOffset(0); setSelected([]); }
    function openFolder(id) { setFolderId(id); setTab('all'); setOffset(0); setSearch(''); setQuery(''); setSelected([]); }
    function changeView(value) { setView(value); try { localStorage.setItem(ID + ':view',value); } catch {} }
    function download(item) {
      const anchor = document.createElement('a'); anchor.href = assetUrl(item,false,true); anchor.download = item.name;
      document.body.append(anchor); anchor.click(); anchor.remove();
    }
    async function uploadFiles(files) {
      if (!files.length || busy || !status?.configured) return;
      await run(async () => {
        try {
          for (let index = 0; index < files.length; index++) {
            const file = files[index];
            if (file.size > status.maxFileBytes) throw new Error(t('tooLarge') + file.name);
            setProgress({ index:index + 1,total:files.length,name:file.name });
            const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
            for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start,start + 32768));
            await api('upload',{ name:file.name,base64:btoa(binary),folderId:folderId ?? '' });
          }
          setNotice(t('saved') + ' · ' + files.length); setOffset(0);
        } finally { setProgress(null); }
      });
    }
    function drop(event) {
      event.preventDefault(); dragDepth.current=0; setDragging(false);
      void uploadFiles(Array.from(event.dataTransfer.files ?? []));
    }
    const button = (label,props={},icon) => h('button',{ type:'button',disabled:busy,...props },icon ? h(Icon,{ name:icon,size:17 }) : null,t(label));
    const iconButton = (label,icon,props={}) => h('button',{ type:'button',className:'dlf-icon',title:t(label),'aria-label':t(label),disabled:busy,...props },h(Icon,{ name:icon,size:19 }));
    function favorite(item) { void run(async () => { const next = await api('update',{ id:item.id,favorite:!item.favorite }); if (preview?.id === item.id) setPreview(next); }); }
    function edit(item) { setPreview(item); setEditTitle(item.title); setEditDescription(item.description ?? ''); setEditTags((item.tags ?? []).join(', ')); setEditFolder(item.folderId ?? ''); setEditOpen(true); }
    function choose(item) { setSelected(values => values.includes(item.id) ? values.filter(id => id !== item.id) : [...values,item.id]); }
    const childrenFolders = folders.filter(folder => folder.parentId === (folderId ?? '') && (!search || folder.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
    const breadcrumbs = []; let ancestor = current,seen = new Set();
    while (ancestor && !seen.has(ancestor.id)) { seen.add(ancestor.id); breadcrumbs.unshift(ancestor); ancestor = folders.find(folder => folder.id === ancestor.parentId); }
    const folderOptions = [h('option',{ key:'',value:'' },t('unfiled')),...folders.map(folder => h('option',{ key:folder.id,value:folder.id },labelFolder(folder.id)))];
    function kindIcon(item,size=42) {
      const kind = kindOf(item),name = kind === 'image' ? 'image' : kind === 'note' ? 'note' : 'file';
      return h('span',{ className:'dlf-document-symbol dlf-kind-' + kind },h(Icon,{ name,size }),size > 24 ? h('span',null,kind === 'pdf' ? 'PDF' : kind === 'document' ? 'DOC' : kind === 'spreadsheet' ? 'XLS' : kind === 'presentation' ? 'PPT' : kind === 'note' ? 'TXT' : '') : null);
    }
    const cards = data.items ?? [];
    function itemCard(item) {
      return h('article',{ key:item.id,className:'dlf-card' + (selected.includes(item.id) ? ' selected' : ''),'data-item-id':item.id },
        h('button',{ type:'button',className:'dlf-cover','aria-label':t('preview') + ' ' + item.title,onClick:() => { setPreview(item); setEditOpen(false); } },
          kindOf(item) === 'image' ? h(Image,{ item,className:'dlf-image',alt:item.title }) : h('span',{ className:'dlf-document-cover' },kindIcon(item))),
        h('div',{ className:'dlf-card-actions' },
          h('input',{ type:'checkbox',className:'dlf-select',checked:selected.includes(item.id),'aria-label':t('selectItem') + ' ' + item.title,onChange:() => choose(item) }),
          iconButton(item.favorite ? 'unfavorite' : 'favorite','star',{ className:'dlf-icon' + (item.favorite ? ' is-favorite' : ''),'aria-pressed':Boolean(item.favorite),onClick:() => favorite(item) })),
        h('div',{ className:'dlf-card-caption' },h('div',{ className:'dlf-card-title',title:item.name },h('span',{ className:'dlf-ellipsis' },item.title || item.name),iconButton('edit','dots',{ onClick:() => edit(item) })),
          h('div',{ className:'dlf-card-sub' },h('span',{ className:'dlf-ellipsis' },item.folderId ? labelFolder(item.folderId) : t(kindOf(item))),h('span',null,bytesLabel(item.bytes)))));
    }
    const noItemsTitle = search ? 'noMatches' : tab === 'favorites' ? 'emptyFavorites' : tab === 'folders' ? 'emptyFolders' : 'empty';
    const noItemsHint = search ? 'noMatchesHint' : tab === 'favorites' ? 'emptyFavoritesHint' : tab === 'folders' ? 'emptyFoldersHint' : 'emptyHint';
    const directoryForm = h('form',{ className:'dlf-settings-body',onSubmit:event => {
      event.preventDefault(); void run(async () => { await api('configure',{ directory }); dirty.current=false; setSettings(false); setFolderId(undefined); setOffset(0); setSelected([]); });
    } },h('label',{ htmlFor:'dlf-directory' },t('directory')),
      h('input',{ id:'dlf-directory',value:directory,placeholder:'F:\\Library',onChange:event => { dirty.current=true; setDirectory(event.target.value); } }),
      h('p',null,t('directoryHint')),status?.configured ? h('p',null,t('fileLimit') + ': ' + bytesLabel(status.maxFileBytes)) : null,
      h('div',{ className:'dlf-dialog-actions' },button('saveDirectory',{ type:'submit',className:'dlf-primary',disabled:busy || !directory.trim() })));
    return h('section',{ className:'dlf-root',onDrop:drop,onDragOver:event => { if (Array.from(event.dataTransfer.types ?? []).includes('Files')) event.preventDefault(); },
      onDragEnter:event => { if (status?.configured && Array.from(event.dataTransfer.types ?? []).includes('Files')) { event.preventDefault(); dragDepth.current++; setDragging(true); } },
      onDragLeave:event => { event.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current=0; setDragging(false); } },
    },h('style',null,css),h('div',{ className:'dlf-wrap' },
      h('header',{ className:'dlf-head' },h('h1',null,t('library')),h('div',{ className:'dlf-toolbar' },
        h('div',{ className:'dlf-toggle',role:'group','aria-label':t('grid') },
          iconButton('grid','grid',{ 'aria-pressed':view === 'grid',onClick:() => changeView('grid') }),
          iconButton('listView','list',{ 'aria-pressed':view === 'list',onClick:() => changeView('list') })),
        h('form',{ className:'dlf-search',role:'search',onSubmit:event => { event.preventDefault(); setSearch(query); setOffset(0); } },h(Icon,{ name:'search',size:17 }),
          h('input',{ type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:event => setQuery(event.target.value) })),
        h('div',{ className:'dlf-new-wrap' },button('new',{ className:'dlf-primary','aria-expanded':menu,onClick:() => setMenu(!menu),disabled:busy || !status?.configured },'plus'),
          menu ? h('div',{ className:'dlf-menu',role:'menu',onKeyDown:event => { if (event.key === 'Escape') setMenu(false); } },
            button('upload',{ role:'menuitem',onClick:() => { setMenu(false); picker.current.click(); } },'upload'),
            button('newNote',{ role:'menuitem',onClick:() => { setMenu(false); setNoteOpen(true); } },'note'),
            button('newFolder',{ role:'menuitem',onClick:() => { setMenu(false); setFolderEdit({ create:true }); setFolderName(''); } },'folder')) : null),
        iconButton('settings','settings',{ onClick:() => setSettings(true) }))),
      h('input',{ type:'file',multiple:true,hidden:true,ref:picker,'aria-label':t('upload'),onChange:event => { const files=Array.from(event.target.files ?? []); event.target.value=''; void uploadFiles(files); } }),
      h('nav',{ className:'dlf-tabs',role:'tablist','aria-label':t('library') },['recommended','favorites','folders','images','all'].map(value => h('button',{ type:'button',key:value,role:'tab',className:'dlf-tab','aria-selected':tab === value,onClick:() => changeTab(value) },t(value)))),
      folderId !== undefined ? h('nav',{ className:'dlf-breadcrumbs','aria-label':t('folder') },
        h('button',{ type:'button',onClick:() => openFolder(undefined) },t('library')),
        breadcrumbs.map(folder => h(React.Fragment,{ key:folder.id },h(Icon,{ name:'chevron',size:13 }),
          folder.id === folderId ? h('span',null,folder.name) : h('button',{ type:'button',onClick:() => openFolder(folder.id) },folder.name))),
        current ? iconButton('editFolder','edit',{ onClick:() => { setFolderEdit(current); setFolderName(current.name); } }) : null) : null,
      error || status?.initializationError ? h('div',{ role:'alert',className:'dlf-error' },error || status.initializationError.message) : null,
      notice ? h('p',{ role:'status',className:'dlf-notice' },notice) : null,
      progress ? h('div',{ className:'dlf-progress',role:'status' },h('progress',{ value:progress.index,max:progress.total }),t('uploading') + ' ' + progress.index + '/' + progress.total + ' · ' + progress.name) : null,
      !status?.configured && !loading ? h('div',{ className:'dlf-empty' },h(Icon,{ name:'folder',size:48 }),h('h3',null,t('setup')),h('p',null,t('intro')),directoryForm) : null,
      status?.configured ? h(React.Fragment,null,
        selected.length ? h('div',{ className:'dlf-batch' },h('strong',null,t('selected') + ' ' + selected.length),
          button('move',{ className:'dlf-secondary',onClick:() => { setDestination(folderId ?? ''); setMoveOpen(true); } }),
          button('favorite',{ className:'dlf-secondary',onClick:() => run(async () => { for (const id of selected) await api('update',{ id,favorite:true }); setSelected([]); }) }),
          iconButton('clearSelection','close',{ onClick:() => setSelected([]) })) : null,
        ['all','recommended','folders'].includes(tab) && childrenFolders.length ? h(React.Fragment,null,
          h('div',{ className:'dlf-section' },h('h2',null,t('folders')),h('span',{ className:'dlf-count' },childrenFolders.length + ' ' + t('total'))),
          h('div',{ className:'dlf-folders' },childrenFolders.map(folder => h('button',{ type:'button',className:'dlf-folder',key:folder.id,onClick:() => openFolder(folder.id),'aria-label':t('folder') + ' ' + folder.name },
            h('div',{ className:'dlf-folder-head' },h(Icon,{ name:'folder',size:18 }),h('span',{ className:'dlf-ellipsis' },folder.name),h('span',{ className:'dlf-count' },folder.count)),
            h('div',{ className:'dlf-folder-cover' },folder.covers?.length ? h('div',{ className:'dlf-folder-stack' },folder.covers.map(item => h(Image,{ key:item.id,item,alt:'' }))) : h(Icon,{ name:'folder',size:45 })))))) : null,
        tab !== 'folders' ? h(React.Fragment,null,
          h('div',{ className:'dlf-section' },h('h2',null,t('items'),h('span',{ className:'dlf-count',style:{ marginLeft:10 } },data.total)),
            h('div',{ className:'dlf-row' },h('select',{ className:'dlf-sort',value:sort,'aria-label':t('recent'),onChange:event => { setSort(event.target.value); setOffset(0); } },(tab === 'recommended' ? ['recommended','recent','oldest','name','size'] : ['recent','oldest','name','size']).map(value => h('option',{ key:value,value },t(value === 'recommended' ? 'recommendedSort' : value)))),
              iconButton('refresh','refresh',{ onClick:() => run(async () => { const report=await api('refresh',{}); if (report.errorCount || report.capped) setNotice(JSON.stringify(report)); }) }))),
          view === 'grid' ? h(Masonry,{ items:cards,render:itemCard }) :
            h('table',{ className:'dlf-table' },h('thead',null,h('tr',null,['','name','folder','size','date',''].map((value,index) => h('th',{ key:index },value ? t(value) : '')))),
              h('tbody',null,cards.map(item => h('tr',{ key:item.id,'data-item-id':item.id },
                h('td',null,h('input',{ type:'checkbox',className:'dlf-select','aria-label':t('selectItem') + ' ' + item.title,checked:selected.includes(item.id),onChange:() => choose(item) })),
                h('td',null,h('button',{ type:'button',className:'dlf-table-title',onClick:() => { setPreview(item); setEditOpen(false); } },kindOf(item) === 'image' ? h(Image,{ item,className:'dlf-table-thumb',alt:'' }) : kindIcon(item,25),h('span',{ className:'dlf-ellipsis' },item.title || item.name))),
                h('td',{ className:'dlf-ellipsis' },labelFolder(item.folderId)),h('td',{ className:'dlf-muted' },bytesLabel(item.bytes)),h('td',{ className:'dlf-muted' },dateLabel(item.createdAt)),
                h('td',null,iconButton(item.favorite ? 'unfavorite' : 'favorite','star',{ className:'dlf-icon' + (item.favorite ? ' is-favorite' : ''),'aria-pressed':Boolean(item.favorite),onClick:() => favorite(item) })))))),
          !cards.length ? h('div',{ className:'dlf-empty' },h(Icon,{ name:tab === 'favorites' ? 'star' : search ? 'search' : 'file',size:46 }),h('h3',null,t(noItemsTitle)),h('p',null,t(noItemsHint)),!search && tab === 'all' ? button('upload',{ className:'dlf-secondary',onClick:() => picker.current.click() }) : null) : null,
          offset > 0 || data.nextOffset != null ? h('div',{ className:'dlf-pager' },button('previous',{ className:'dlf-secondary',disabled:busy || offset === 0,onClick:() => { setOffset(Math.max(0,offset - 60)); setSelected([]); } }),h('span',{ className:'dlf-count' },Math.floor(offset / 60) + 1),button('next',{ className:'dlf-secondary',disabled:busy || data.nextOffset == null,onClick:() => { setOffset(data.nextOffset); setSelected([]); } })) : null) : null,
        tab === 'folders' && !childrenFolders.length ? h('div',{ className:'dlf-empty' },h(Icon,{ name:'folder',size:46 }),h('h3',null,t(noItemsTitle)),h('p',null,t(noItemsHint)),button('newFolder',{ className:'dlf-primary',onClick:() => { setFolderEdit({ create:true }); setFolderName(''); } })) : null) : null,
      loading ? h('div',{ className:'dlf-gallery','aria-busy':true },[0,1,2,3].map(value => h('div',{ key:value,className:'dlf-loading' }))) : null,
      h('p',{ className:'dlf-muted',style:{ marginTop:32,fontSize:10,opacity:.5 } },'DSH Library · 0.2.0')),
      settings ? h(Dialog,{ title:t('settings'),onClose:() => setSettings(false),t },directoryForm) : null,
      noteOpen ? h(Dialog,{ title:t('newNote'),onClose:() => setNoteOpen(false),t },
        h('form',{ onSubmit:event => { event.preventDefault(); void run(async () => { await api('note',{ name:'note.md',title:noteTitle || 'note.md',content:noteContent,tags:tags(noteTags),folderId:folderId ?? '' }); setNoteOpen(false); setNoteTitle(''); setNoteContent(''); setNoteTags(''); setNotice(t('saved')); }); } },
          h('label',{ htmlFor:'dlf-note-title' },t('title')),h('input',{ id:'dlf-note-title',value:noteTitle,onChange:event => setNoteTitle(event.target.value) }),
          h('label',{ htmlFor:'dlf-note-content' },t('content')),h('textarea',{ id:'dlf-note-content',value:noteContent,onChange:event => setNoteContent(event.target.value),style:{ minHeight:220 } }),
          h('label',{ htmlFor:'dlf-note-tags' },t('tags')),h('input',{ id:'dlf-note-tags',value:noteTags,placeholder:t('tagsHint'),onChange:event => setNoteTags(event.target.value) }),
          h('div',{ className:'dlf-dialog-actions' },button('cancel',{ onClick:() => setNoteOpen(false) }),button('saveNote',{ className:'dlf-primary',type:'submit' })))) : null,
      folderEdit ? h(Dialog,{ title:t(folderEdit.create ? 'newFolder' : 'editFolder'),onClose:() => setFolderEdit(null),t },
        h('form',{ onSubmit:event => { event.preventDefault(); void run(async () => { await api(folderEdit.create ? 'createFolder' : 'renameFolder',folderEdit.create ? { name:folderName.trim(),parentId:folderId ?? '' } : { id:folderEdit.id,name:folderName.trim() }); setFolderEdit(null); }); } },
          h('label',{ htmlFor:'dlf-folder-name' },t('folderName')),h('input',{ id:'dlf-folder-name',value:folderName,required:true,onChange:event => setFolderName(event.target.value) }),
          !folderEdit.create ? h('p',{ className:'dlf-muted' },t('removeFolderHint')) : null,
          h('div',{ className:'dlf-dialog-actions' },!folderEdit.create ? button('removeFolder',{ className:'dlf-danger',onClick:() => run(async () => { const result=await api('removeFolder',{ id:folderEdit.id }); setFolderEdit(null); openFolder(result.parentId || undefined); }) }) : null,
            button('cancel',{ onClick:() => setFolderEdit(null) }),button('save',{ type:'submit',className:'dlf-primary',disabled:busy || !folderName.trim() })))) : null,
      moveOpen ? h(Dialog,{ title:t('move'),onClose:() => setMoveOpen(false),t },h('label',{ htmlFor:'dlf-destination' },t('chooseFolder')),h('select',{ id:'dlf-destination',value:destination,onChange:event => setDestination(event.target.value) },folderOptions),
        h('div',{ className:'dlf-dialog-actions' },button('cancel',{ onClick:() => setMoveOpen(false) }),button('save',{ className:'dlf-primary',onClick:() => run(async () => { for (const id of selected) await api('update',{ id,folderId:destination }); setSelected([]); setMoveOpen(false); }) }))) : null,
      preview ? h(Dialog,{ title:preview.title || preview.name,wide:true,onClose:() => { setPreview(null); setEditOpen(false); },t },
        h('div',{ className:'dlf-preview-grid' },h('div',null,
          kindOf(preview) === 'pdf' ? h('div',{ className:'dlf-row',style:{ marginBottom:12 } },button('preview',{ className:'dlf-secondary','aria-pressed':!textMode,onClick:() => setTextMode(false) }),button('textPreview',{ className:'dlf-secondary','aria-pressed':textMode,onClick:() => setTextMode(true) })) : null,
          h('div',{ className:'dlf-preview-media' },kindOf(preview) === 'image' ? h(Image,{ item:preview,thumbnail:false,alt:preview.title }) :
            kindOf(preview) === 'pdf' && !textMode ? h('iframe',{ src:assetUrl(preview),title:preview.title }) :
            h('pre',{ className:'dlf-preview-text' },details ? details.text || t('noPreview') : t('busy'))),
          previewError ? h('p',{ className:'dlf-error',role:'alert' },previewError) : null,
          details?.nextOffset != null ? button('more',{ className:'dlf-secondary',onClick:() => run(async () => { const next=await api('read',{ id:preview.id,offset:details.nextOffset }); setDetails({ ...next,text:details.text + next.text }); }) }) : null),
          h('aside',{ className:'dlf-details' },h('div',{ className:'dlf-row',style:{ marginBottom:14 } },
            iconButton(preview.favorite ? 'unfavorite' : 'favorite','star',{ 'aria-pressed':Boolean(preview.favorite),onClick:() => favorite(preview) }),
            button('download',{ className:'dlf-secondary',onClick:() => download(preview) })),
            h('p',{ className:'dlf-muted' },preview.name + ' · ' + bytesLabel(preview.bytes)),
            editOpen ? h('form',{ onSubmit:event => { event.preventDefault(); void run(async () => { const next=await api('update',{ id:preview.id,title:editTitle.trim() || preview.name,description:editDescription,tags:tags(editTags),folderId:editFolder }); setPreview(next); setEditOpen(false); setNotice(t('saved')); }); } },
              h('label',{ htmlFor:'dlf-edit-title' },t('title')),h('input',{ id:'dlf-edit-title',value:editTitle,onChange:event => setEditTitle(event.target.value) }),
              h('label',{ htmlFor:'dlf-edit-description' },t('description')),h('textarea',{ id:'dlf-edit-description',value:editDescription,onChange:event => setEditDescription(event.target.value) }),
              h('label',{ htmlFor:'dlf-edit-tags' },t('tags')),h('input',{ id:'dlf-edit-tags',value:editTags,onChange:event => setEditTags(event.target.value) }),
              h('label',{ htmlFor:'dlf-edit-folder' },t('folder')),h('select',{ id:'dlf-edit-folder',value:editFolder,onChange:event => setEditFolder(event.target.value) },folderOptions),
              h('div',{ className:'dlf-dialog-actions' },button('cancel',{ onClick:() => setEditOpen(false) }),button('save',{ className:'dlf-primary',type:'submit' }))) :
              h(React.Fragment,null,preview.description ? h('p',null,preview.description) : null,
                h('div',{ className:'dlf-tags' },(preview.tags ?? []).map(tag => h('span',{ className:'dlf-tag',key:tag },tag))),
                h('p',{ className:'dlf-muted' },t('folder') + ' · ' + labelFolder(preview.folderId)),
                button('edit',{ className:'dlf-secondary',onClick:() => edit(preview) })),
            h('p',{ className:'dlf-muted' },t(preview.indexStatus)),details?.textTruncated ? h('p',{ className:'dlf-muted' },t('truncated')) : null,
            h('label',null,t('originalPath')),h('p',{ className:'dlf-path' },preview.path),
            button('copyPath',{ className:'dlf-secondary',onClick:() => run(async () => { await navigator.clipboard.writeText(preview.path); setNotice(t('copied')); }) })))) : null,
      dragging ? h('div',{ className:'dlf-drop' },h(Icon,{ name:'upload',size:54 }),t('dropped'),current ? h('small',null,current.name) : null) : null);
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
      const stopSidebar = pageCtx.slots.inject('sidebar.panellist',() => pageCtx.slots.register({ name:'sidebar.panellist',id:ID,order:30,label:() => t('library'),locale:ID },props => h(Icon,{ name:'folder',...props })));
      return () => { stopSidebar(); stopPage(); };
    }));
  }
  return { name:'dsh-file-manager-client',inject:['slots','connection','locale'],apply,LibraryPage };
};
