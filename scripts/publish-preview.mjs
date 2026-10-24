import { readFile } from 'node:fs/promises';
const repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN,source=process.env.GITHUB_SHA;
if (!repository || !token || !source) throw new Error('Run preview publication in the repository workflow.');
const branch='library-preview';
async function api(endpoint,method='GET',body) {
  const response=await fetch('https://api.github.com/repos/'+repository+endpoint,{
    method,headers:{ authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',...(body ? { 'content-type':'application/json' } : {}) },
    ...(body ? { body:JSON.stringify(body) } : {}),
  });
  if (response.status===404 && method==='GET') return null;
  if (!response.ok) throw new Error('Preview GitHub operation failed: '+response.status+' '+endpoint);
  return response.status===204 ? null : response.json();
}
if (!(await api('/git/ref/heads/'+branch))) await api('/git/refs','POST',{ ref:'refs/heads/'+branch,sha:source });
for (const name of ['gallery-desktop.png','gallery-mobile.png']) {
  const target='docs/'+name;
  const existing=await api('/contents/'+target+'?ref='+branch);
  const bytes=await readFile('.artifacts/'+name);
  await api('/contents/'+target,'PUT',{ message:'docs: gallery preview from '+source.slice(0,12),branch,content:bytes.toString('base64'),...(existing ? { sha:existing.sha } : {}) });
}
console.log('Preview screenshots published to '+branch+' for source '+source.slice(0,12)+'.');
