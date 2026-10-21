import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(fileURLToPath(new URL('../site/', import.meta.url)));
const pages = ['index.html', 'es/index.html'];
const attrs = html => [...html.matchAll(/\b(href|src)="([^"]+)"/g)].map(m => ({ attr: m[1], value: m[2] }));
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

test('EN and ES are static, locally linked, correctly localized and share install anchors', async () => {
  const documents = await Promise.all(pages.map(p => readFile(resolve(site, p), 'utf8')));
  for (const [i, html] of documents.entries()) {
    const lang = i ? 'es' : 'en';
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.doesNotMatch(html, /<script\b|\bon\w+=/i);
    assert.equal(new Set(ids(html)).size, ids(html).length, 'unique ids');
    const footer = JSON.parse(await readFile(new URL(`../_locales/${lang}/messages.json`, import.meta.url))).footerBy.message;
    assert.ok(html.includes(footer));
    const links = attrs(html);
    assert.ok(links.some(({ value }) => resolve(dirname(resolve(site, pages[i])), value) === resolve(site, pages[1 - i])));
    assert.match(html, /hreflang="en"/); assert.match(html, /hreflang="es"/);
    for (const { attr, value } of links) {
      if (/^https?:/.test(value)) {
        assert.ok(['github.com', 'particular-labs.github.io'].includes(new URL(value).hostname), value);
        assert.equal(attr, 'href', 'no remote assets');
        continue;
      }
      assert.doesNotMatch(value, /^(?:\/|[a-z]+:)/i, 'relative URLs only');
      const [path, hash] = value.split('#');
      const target = path ? resolve(dirname(resolve(site, pages[i])), path) : resolve(site, pages[i]);
      assert.ok(target.startsWith(site + sep), value);
      assert.ok((await stat(target)).isFile(), value);
      if (hash) assert.ok(ids(await readFile(target, 'utf8')).includes(hash), value);
      if (value.endsWith('.webp')) assert.ok((await stat(target)).size <= 60_000, value);
    }
  }
  const anchors = documents.map(html => ids(html).filter(id => id.startsWith('install')));
  assert.deepEqual(anchors[0], anchors[1]);
  assert.equal(anchors[0].filter(id => /^install-step-/.test(id)).length, 6);
  const css = await readFile(resolve(site, 'styles.css'), 'utf8');
  for (const [, url] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    assert.doesNotMatch(url, /^(?:\/|[a-z]+:)/i);
    assert.ok((await stat(resolve(site, url))).isFile());
  }
});

test('privacy pages (EN + ES) state the policy, list every permission, and are linked from the footers', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  const privacy = ['privacy.html', 'es/privacy.html'];
  for (const [i, page] of privacy.entries()) {
    const html = await readFile(resolve(site, page), 'utf8');
    assert.match(html, new RegExp(`<html lang="${i ? 'es' : 'en'}">`));
    assert.doesNotMatch(html, /<script\b|\bon\w+=/i);
    assert.ok(html.includes('mailto:admin@particularlabs.com'));
    for (const permission of manifest.permissions) assert.ok(html.includes(`<code>${permission}</code>`), permission);
    assert.ok(attrs(html).some(({ value }) => resolve(dirname(resolve(site, page)), value) === resolve(site, privacy[1 - i])), 'links to the other language');
    for (const { value } of attrs(html)) {
      if (/^(?:https?|mailto):/.test(value)) continue;
      const path = value.split('#')[0];
      assert.ok((await stat(path ? resolve(dirname(resolve(site, page)), path) : resolve(site, page))).isFile(), value);
    }
    const home = await readFile(resolve(site, pages[i]), 'utf8');
    assert.ok(attrs(home).some(({ value }) => value === 'privacy.html'), 'footer links to the privacy page');
  }
});
