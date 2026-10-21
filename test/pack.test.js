import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { packFiles, buildZip, crc32, collectFiles } from '../scripts/pack.mjs';

const root = new URL('../', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// Independent central-directory reader: validate local headers and inflate every member.
function readZip(zip) {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  const count = zip.readUInt16LE(end + 10), files = new Map();
  let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50);
    const length = zip.readUInt16LE(cursor + 28);
    const name = zip.subarray(cursor + 46, cursor + 46 + length).toString();
    const offset = zip.readUInt32LE(cursor + 42);
    assert.equal(zip.readUInt32LE(offset), 0x04034b50);
    assert.equal(zip.readUInt16LE(offset + 8), 8);
    assert.equal(zip.subarray(offset + 30, offset + 30 + zip.readUInt16LE(offset + 26)).toString(), name);
    const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
    const data = inflateRawSync(zip.subarray(start, start + zip.readUInt32LE(cursor + 20)));
    assert.equal(data.length, zip.readUInt32LE(cursor + 24));
    assert.equal(crc32(data), zip.readUInt32LE(cursor + 16));
    assert.equal(crc32(data), zip.readUInt32LE(offset + 14));
    assert.ok(!files.has(name)); files.set(name, data);
    cursor += 46 + length + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  assert.equal(cursor, end);
  return files;
}

async function scratch(t) {
  const base = fileURLToPath(new URL('../.scratch/', import.meta.url));
  await mkdir(base, { recursive: true });
  const dir = await mkdtemp(`${base}/pack-`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('pack is reproducible, below 300 KB, complete and verifiable after extraction', async t => {
  const dir = await scratch(t);
  const a = await packFiles({ output: resolve(dir, 'a') });
  const b = await packFiles({ output: resolve(dir, 'b') });
  assert.deepEqual(a.zip, b.zip);
  assert.deepEqual(a.sums, b.sums);
  assert.ok(a.zip.length < 300_000, `STOP: packed extension is ${a.zip.length} bytes (limit 300 KB)`);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
  const prefix = `ram-nudge-${manifest.version}/`;
  assert.equal(a.filename, `ram-nudge-${manifest.version}-chrome.zip`);
  assert.equal(a.sums.version, manifest.version);
  const savedSums = JSON.parse(await readFile(resolve(dir, 'a/SHA256SUMS.json')));
  assert.deepEqual(savedSums, a.sums);
  assert.equal(savedSums[a.filename], digest(await readFile(resolve(dir, 'a', a.filename))));
  const files = readZip(a.zip);
  assert.deepEqual(JSON.parse(files.get(`${prefix}manifest.json`)), manifest);
  assert.deepEqual([...files.keys()], [...files.keys()].sort());
  for (const [name, data] of files) {
    assert.ok(name.startsWith(prefix));
    assert.doesNotMatch(name.slice(prefix.length), /(^|\/)(?:\.|test\/|scripts\/|site\/|docs\/|dist\/|package\.json|README)/);
    assert.equal(savedSums.files[name], digest(data), name);
  }
  assert.deepEqual(Object.keys(savedSums.files).sort(), [...files.keys()].sort());
  const references = [manifest.background.service_worker, manifest.action.default_popup,
    manifest.options_ui.page, ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
    `_locales/${manifest.default_locale}/messages.json`, 'fonts/OFL.txt', 'LICENSE'];
  for (const name of references) assert.ok(files.has(prefix + name), `missing ${name}`);
  // The Chrome Web Store zip holds the same files with manifest.json at the root.
  assert.equal(a.storeFilename, `ram-nudge-${manifest.version}-store.zip`);
  const store = readZip(a.storeZip);
  assert.deepEqual([...store.keys()], [...files.keys()].map(n => n.slice(prefix.length)));
  assert.deepEqual(JSON.parse(store.get('manifest.json')), manifest);
  assert.equal(savedSums[a.storeFilename], digest(a.storeZip));
  // Compare every shipped member with source, catching silent omissions beyond manifest references.
  for (const { name, data } of await collectFiles()) assert.deepEqual(files.get(prefix + name), data);
});

test('explicit allowlist ignores stray files and excluded trees', async t => {
  const source = await scratch(t);
  for (const path of ['test/leak.js', 'site/leak.html', 'docs/leak.css', '.github/leak.js', '.scratch/leak.js', 'lib/.secret.js', 'lib/notes.txt', 'icons/secret.json', 'fonts/notes.md', 'package.json', 'README.md', '.env', 'stray.txt']) {
    const full = resolve(source, path);
    await mkdir(resolve(full, '..'), { recursive: true });
    await writeFile(full, 'must not ship');
  }
  await writeFile(resolve(source, 'manifest.json'), '{}');
  assert.deepEqual((await collectFiles(source)).map(f => f.name), ['manifest.json']);
});

test('ZIP CRC matches the standard vector and writer sorts and rejects unsafe names', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const a = { name: 'folder/a.js', data: Buffer.from('hello') };
  const b = { name: 'folder/b.js', data: Buffer.from('world') };
  assert.deepEqual(buildZip([b, a]), buildZip([a, b]));
  for (const name of ['/absolute', '../parent', 'folder/../escape', 'folder\\escape']) {
    assert.throws(() => buildZip([{ ...a, name }]), /Unsafe/);
  }
  assert.throws(() => buildZip([a, a]), /duplicate/);
});
