const fs = require('node:fs');
const path = require('node:path');
const factory = require('../src/client-factory.cjs');
const normalize = value => value.replace(/\r\n/g,'\n');
const output = 'window.__ModuleLoader__.load({id:"dsh-file-manager",factory:' + normalize(factory.toString()) + '});\n';
const target = path.join(__dirname,'../client.js');
if (process.argv.includes('--check')) {
  if (normalize(fs.readFileSync(target,'utf8')) !== output) throw new Error('client.js is stale; run npm run build.');
} else fs.writeFileSync(target,output);
