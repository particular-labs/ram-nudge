import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folders = new Set(['lib', '_locales', 'icons', 'stages', 'fonts']);
const extensions = new Map([
  ['lib', /\.js$/], ['_locales', /^_locales\/[^/.]+\/messages\.json$/],
  ['icons', /\.(png|svg)$/], ['stages', /\.(png|svg)$/],
  ['fonts', /(?:\.woff2$|^fonts\/OFL\.txt$)/],
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP32, UTF-8 names, deflate, fixed DOS timestamp (1980-01-01), no extras.
export function buildZip(files) {
  const local = [], central = [];
  let offset = 0;
  const sorted = [...files].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const names = new Set();
  for (const { name, data } of sorted) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(p => !p || p.startsWith('.')) || names.has(name)) {
      throw new Error(`Unsafe or duplicate ZIP path: ${name}`);
    }
    names.add(name);
    const filename = Buffer.from(name), compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(8, 10); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(offset, 42); central.push(entry, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(sorted.length, 8); end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export async function collectFiles(source = root) {
  const files = [];
  async function walk(relative = '') {
    for (const entry of await readdir(resolve(source, relative), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const top = name.split('/')[0];
      if (entry.isDirectory() && folders.has(top)) await walk(name);
      if (!entry.isFile()) continue; // Never follow symlinks into another tree.
      const allowed = relative ? extensions.get(top)?.test(name) : /^(manifest\.json|LICENSE|[^/.]+\.(js|html|css))$/.test(name);
      if (allowed) files.push({ name, data: await readFile(resolve(source, name)) });
    }
  }
  await walk();
  return files;
}

export async function packFiles({ source = root, output = resolve(root, 'dist') } = {}) {
  const files = await collectFiles(source);
  const { version } = JSON.parse(files.find(f => f.name === 'manifest.json').data);
  if (!/^\d+(?:\.\d+){0,3}$/.test(version)) throw new Error('Invalid manifest version');
  const prefix = `ram-nudge-${version}`;
  const entries = files.map(f => ({ ...f, name: `${prefix}/${f.name}` }));
  const zip = buildZip(entries), filename = `${prefix}-chrome.zip`;
  // The top-level archive digest supports download verification; files audits every member.
  const sums = { version, [filename]: sha256(zip), files: Object.fromEntries(entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).map(f => [f.name, sha256(f.data)])) };
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, filename), zip);
  await writeFile(resolve(output, 'SHA256SUMS.json'), `${JSON.stringify(sums, null, 2)}\n`);
  return { filename, zip, sums };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { filename, zip, sums } = await packFiles();
  console.log(`${filename}: ${zip.length} bytes\nSHA256 ${sums[filename]}\nSHA256SUMS.json: archive + per-file hashes`);
}
