/** Tests for built-site fragment validation. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectSiteFragments, missingSiteFiles } from './verify-doc-site-fragments.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-doc-fragments-'))
  roots.push(root)
  mkdirSync(join(root, 'guide'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<a id="home"></a><a href="/guide/start#ready">start</a>')
  writeFileSync(join(root, 'guide/start.html'), [
    '<h1 id="ready">Ready</h1>',
    '<a name="legacy"></a>',
    '<a href="#ready">same page</a>',
    '<a href="./start.html#legacy">html alias</a>',
    '<a href="../#home">root</a>',
    '<a href="https://example.com/page#missing">external</a>',
  ].join(''))
  return root
}

function htmlFixture(pages: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-doc-fragments-html-'))
  roots.push(root)
  for (const [file, html] of Object.entries(pages)) writeFileSync(join(root, file), html)
  return root
}

describe('inspectSiteFragments', () => {
  it('rejects a directory with no built pages', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-doc-fragments-empty-'))
    roots.push(root)

    expect(() => inspectSiteFragments(root)).toThrow('no HTML files found')
  })

  it('resolves clean, encoded, and same-page routes', () => {
    const root = fixture()
    writeFileSync(
      join(root, 'guide/encoded.html'),
      '<h1 id="a b">Encoded</h1><h2 id="%">Literal</h2><a href="./encoded#a%20b">encoded</a><a href="#%">literal</a>',
    )

    expect(inspectSiteFragments(root)).toEqual({ checked: 6, broken: [] })
  })

  it('rejects ambiguous built routes', () => {
    const root = fixture()
    writeFileSync(join(root, 'guide.html'), '<h1 id="flat">Flat</h1>')
    writeFileSync(join(root, 'guide/index.html'), '<h1 id="index">Index</h1>')

    expect(() => inspectSiteFragments(root)).toThrow('share route "/guide"')
  })

  it('rejects malformed fragment hrefs', () => {
    const root = fixture()
    writeFileSync(join(root, 'guide/invalid.html'), '<a href="http://[invalid]#fragment">invalid</a>')

    expect(() => inspectSiteFragments(root)).toThrow(
      'guide/invalid.html has invalid fragment href "http://[invalid]#fragment"',
    )
  })

  it('reports missing ids and missing built routes', () => {
    const root = fixture()
    writeFileSync(join(root, 'guide/broken.html'), [
      '<a href="./start#missing">id</a>',
      '<a href="./absent#missing">route</a>',
    ].join(''))

    expect(inspectSiteFragments(root).broken).toEqual([
      {
        source: 'guide/broken.html',
        href: './start#missing',
        target: 'guide/start.html',
        fragment: 'missing',
      },
      {
        source: 'guide/broken.html',
        href: './absent#missing',
        fragment: 'missing',
      },
    ])
  })

  it('resolves ids on html, head, and body elements', () => {
    const root = htmlFixture({
      'index.html': [
        '<!doctype html><html id="html-id"><head id="head-id"><title>Ids</title></head>',
        '<body id="body-id">',
        '<a href="#html-id">html</a>',
        '<a href="#head-id">head</a>',
        '<a href="#body-id">body</a>',
        '</body></html>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({ checked: 3, broken: [] })
  })

  it('decodes entities and legacy names while preserving duplicate hrefs', () => {
    const root = htmlFixture({
      'index.html': [
        '<h1 id="a&amp;b">Entity id</h1>',
        '<a name="legacy&amp;name"></a>',
        '<a href="#a&amp;b">id</a>',
        '<a href="#legacy&amp;name">legacy</a>',
        '<a href="#a&amp;b">duplicate id</a>',
        '<a href="#missing&amp;id">missing id</a>',
        '<a href="#other">other missing id</a>',
        '<a href="#missing&amp;id">duplicate missing id</a>',
        '<a id="" name="" href="">empty attributes</a>',
        '<a>absent attributes</a>',
        '<a href="#">empty fragment</a>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 6,
      broken: [
        { source: 'index.html', href: '#missing&id', target: 'index.html', fragment: 'missing&id' },
        { source: 'index.html', href: '#other', target: 'index.html', fragment: 'other' },
        { source: 'index.html', href: '#missing&id', target: 'index.html', fragment: 'missing&id' },
      ],
    })
  })

  it('ignores template contents and script and comment text as fragment targets', () => {
    const root = htmlFixture({
      'index.html': [
        '<template><a id="template-id" name="template-name" href="#template-href"></a></template>',
        '<script>const anchor = \'<a id="script-id" name="script-name" href="#script-href"></a>\';</script>',
        '<!-- <a id="comment-id" name="comment-name" href="#comment-href"></a> -->',
        '<a href="#template-id">template id</a>',
        '<a href="#template-name">template name</a>',
        '<a href="#script-id">script id</a>',
        '<a href="#script-name">script name</a>',
        '<a href="#comment-id">comment id</a>',
        '<a href="#comment-name">comment name</a>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 6,
      broken: [
        { source: 'index.html', href: '#template-id', target: 'index.html', fragment: 'template-id' },
        { source: 'index.html', href: '#template-name', target: 'index.html', fragment: 'template-name' },
        { source: 'index.html', href: '#script-id', target: 'index.html', fragment: 'script-id' },
        { source: 'index.html', href: '#script-name', target: 'index.html', fragment: 'script-name' },
        { source: 'index.html', href: '#comment-id', target: 'index.html', fragment: 'comment-id' },
        { source: 'index.html', href: '#comment-name', target: 'index.html', fragment: 'comment-name' },
      ],
    })
  })

  it('parses noscript anchors with scripting disabled', () => {
    const root = htmlFixture({
      'index.html': [
        '<!doctype html><html><head>',
        '<noscript><style id="head-fallback">body { color: black }</style></noscript>',
        '</head><body><noscript>',
        '<a id="fallback-id" name="fallback-name" href="#outside">fallback</a>',
        '<a href="#missing">missing</a>',
        '</noscript>',
        '<h1 id="outside">Outside</h1>',
        '<a href="#head-fallback">head</a>',
        '<a href="#fallback-id">id</a>',
        '<a href="#fallback-name">name</a>',
        '</body></html>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 5,
      broken: [{ source: 'index.html', href: '#missing', target: 'index.html', fragment: 'missing' }],
    })
  })

  it('resolves SVG ids and anchor hrefs', () => {
    const root = htmlFixture({
      'index.html': [
        '<svg xmlns="http://www.w3.org/2000/svg" id="svg-root">',
        '<g id="svg-group"></g>',
        '<a id="svg-anchor" href="#svg-group"><text>group</text></a>',
        '<a href="#html-id"><text>html</text></a>',
        '<a href="#missing"><text>missing</text></a>',
        '</svg>',
        '<h1 id="html-id">HTML</h1>',
        '<a href="#svg-root">svg</a>',
        '<a href="#svg-anchor">anchor</a>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 5,
      broken: [{ source: 'index.html', href: '#missing', target: 'index.html', fragment: 'missing' }],
    })
  })

  it('preserves duplicate broken fragment order across document, SVG, and noscript elements', () => {
    const root = htmlFixture({
      'index.html': [
        '<!doctype html><html><head><title>Ordered fragments</title></head><body>',
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="#missing"><text>SVG</text></a></svg>',
        '<noscript><a href="/index.html#missing">noscript</a></noscript>',
        '<a href="#missing">HTML</a>',
        '</body></html>',
      ].join(''),
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 3,
      broken: [
        { source: 'index.html', href: '#missing', target: 'index.html', fragment: 'missing' },
        { source: 'index.html', href: '/index.html#missing', target: 'index.html', fragment: 'missing' },
        { source: 'index.html', href: '#missing', target: 'index.html', fragment: 'missing' },
      ],
    })
  })

  it('treats zero-byte HTML as a built page', () => {
    const root = htmlFixture({ 'index.html': '' })

    expect(inspectSiteFragments(root)).toEqual({ checked: 0, broken: [] })

    writeFileSync(join(root, 'links.html'), '<a href="/#missing">empty page</a>')

    expect(inspectSiteFragments(root)).toEqual({
      checked: 1,
      broken: [{ source: 'links.html', href: '/#missing', target: 'index.html', fragment: 'missing' }],
    })
  })

  it('keeps ids isolated across pages and consecutive inspections', () => {
    const root = htmlFixture({
      'index.html': '<h1 id="home-id">Home</h1><a href="/other#other-id">other</a><a href="#other-id">local</a>',
      'other.html': '<h1 id="other-id">Other</h1><a href="/#home-id">home</a><a href="#home-id">local</a>',
    })

    expect(inspectSiteFragments(root)).toEqual({
      checked: 4,
      broken: [
        { source: 'index.html', href: '#other-id', target: 'index.html', fragment: 'other-id' },
        { source: 'other.html', href: '#home-id', target: 'other.html', fragment: 'home-id' },
      ],
    })

    writeFileSync(join(root, 'index.html'), '<a href="#home-id">removed home</a>')
    writeFileSync(join(root, 'other.html'), '<a href="#other-id">removed other</a><a href="/#home-id">removed home</a>')

    expect(inspectSiteFragments(root)).toEqual({
      checked: 3,
      broken: [
        { source: 'index.html', href: '#home-id', target: 'index.html', fragment: 'home-id' },
        { source: 'other.html', href: '#other-id', target: 'other.html', fragment: 'other-id' },
        { source: 'other.html', href: '/#home-id', target: 'index.html', fragment: 'home-id' },
      ],
    })
  })
})

describe('missingSiteFiles', () => {
  it('reports the expected files a build did not emit', () => {
    const root = fixture()
    writeFileSync(join(root, 'guide/start.md'), '# Ready\n')

    expect(missingSiteFiles(root, ['guide/start.md', 'guide/absent.md', 'llms.txt']))
      .toEqual(['guide/absent.md', 'llms.txt'])
  })
})
