import { extname } from 'node:path';

const TEXT = new Set([
  '.txt','.md','.markdown','.csv','.tsv','.json','.jsonl','.yaml','.yml',
  '.toml','.xml','.html','.htm','.log','.rst','.tex','.bib','.py','.js',
  '.ts','.jsx','.tsx','.css','.sql',
]);

/** Extract text locally; unsupported formats retain searchable file metadata. */
export async function extractDocument(bytes, name, maxTextChars) {
  let text;
  const extension = extname(name).toLowerCase();
  if (extension === '.pdf') {
    const { extractText } = await import('unpdf');
    const result = await extractText(new Uint8Array(bytes), { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    text = pages.map((page, i) => '[Page ' + (i + 1) + ']\n' + page).join('\n\n');
  } else if (extension === '.docx') {
    const imported = await import('mammoth');
    const mammoth = imported.default ?? imported;
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (TEXT.has(extension)) {
    const buffer = Buffer.from(bytes);
    const utf16 = buffer.length >= 2 && ((buffer[0] === 255 && buffer[1] === 254) || (buffer[0] === 254 && buffer[1] === 255));
    try {
      text = new TextDecoder(utf16 ? (buffer[0] === 255 ? 'utf-16le' : 'utf-16be') : 'utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('gb18030', { fatal: true }).decode(buffer);
    }
    if (text.includes('\0')) return { text: '', status: 'metadata-only', truncated: false };
  } else return { text: '', status: 'metadata-only', truncated: false };
  return { text: text.slice(0, maxTextChars), status: text.trim() ? 'indexed' : 'no-text', truncated: text.length > maxTextChars };
}

/** FTS terms support English words, Chinese characters and adjacent character pairs. */
export function tokenize(value) {
  const text = value.normalize('NFKC').toLowerCase();
  const terms = text.match(/[a-z0-9_]+/g) ?? [];
  for (const run of text.match(/[\u3400-\u9fff]+/g) ?? []) {
    for (const character of run) terms.push(character);
    for (let i = 0; i + 1 < run.length; i++) terms.push(run.slice(i, i + 2));
  }
  return terms;
}
