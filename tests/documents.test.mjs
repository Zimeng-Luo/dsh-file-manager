import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocument } from '../src/extract.mjs';

function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc=(crc>>>1) ^ (crc&1 ? 0xedb88320 : 0);
  }
  return (crc^0xffffffff)>>>0;
}
function zip(entries) {
  const local=[],central=[]; let offset=0;
  for (const [name,content] of entries) {
    const filename=Buffer.from(name),body=Buffer.from(content),crc=crc32(body);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0); header.writeUInt16LE(20,4);
    header.writeUInt32LE(crc,14); header.writeUInt32LE(body.length,18); header.writeUInt32LE(body.length,22); header.writeUInt16LE(filename.length,26);
    const directory=Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50,0); directory.writeUInt16LE(20,4); directory.writeUInt16LE(20,6);
    directory.writeUInt32LE(crc,16); directory.writeUInt32LE(body.length,20); directory.writeUInt32LE(body.length,24);
    directory.writeUInt16LE(filename.length,28); directory.writeUInt32LE(offset,42);
    local.push(header,filename,body); central.push(directory,filename); offset+=header.length+filename.length+body.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

test('DOCX extracts real text from a minimal Office Open XML document',async () => {
  const bytes=zip([
    ['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>共享 DOCX 资料</w:t></w:r></w:p></w:body></w:document>'],
  ]);
  const result=await extractDocument(bytes,'example.docx',10000);
  assert.equal(result.status,'indexed'); assert.equal(result.text.includes('共享 DOCX 资料'),true);
});

test('PDF extracts actual page text with a page marker',async () => {
  const stream='BT /F1 14 Tf 40 200 Td (Shared library PDF) Tj ET\n';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'endstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  for (let i=0;i<objects.length;i++) { offsets.push(Buffer.byteLength(pdf)); pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'; }
  const start=Buffer.byteLength(pdf);
  pdf+='xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
  const result=await extractDocument(Buffer.from(pdf),'example.pdf',10000);
  assert.equal(result.status,'indexed'); assert.equal(result.text.includes('Shared library PDF'),true);
  assert.equal(result.text.includes('[Page 1]'),true);
});
