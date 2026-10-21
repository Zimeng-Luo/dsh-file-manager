const fs = require('node:fs');
const path = require('node:path');
const factory = require('../src/client-factory.cjs');
const output = 'window.__ModuleLoader__.load({id:"dsh-file-manager",factory:' + factory.toString() + '});\n';
const target = path.join(__dirname,'../client.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target,'utf8') !== output) throw new Error('client.js is stale; run npm run build.');
} else fs.writeFileSync(target,output);
