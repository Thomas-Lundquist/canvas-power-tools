import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeEmbed } from './contentEmbeds.js'

test('Flash is named outright, and marked stale', () => {
  const { label, stale } = describeEmbed('https://example.edu/game.swf')
  assert.match(label, /Flash/)
  assert.equal(stale, true)
})

test('Flash is detected through a query string', () => {
  assert.equal(describeEmbed('https://example.edu/a.swf?autoplay=1').stale, true)
})

test('an embed with no source is stale', () => {
  const { label, stale } = describeEmbed('', 'IFRAME')
  assert.equal(label, 'Embedded iframe with no source')
  assert.equal(stale, true)
})

test('known providers are named', () => {
  const cases = [
    ['https://docs.google.com/presentation/d/abc/embed', /Google Docs/],
    ['https://drive.google.com/file/d/abc/preview',      /Google Drive/],
    ['https://www.youtube.com/embed/abc',                /YouTube/],
    ['https://youtu.be/abc',                             /YouTube/],
    ['https://player.vimeo.com/video/1',                 /Vimeo/],
    ['https://view.officeapps.live.com/op/embed.aspx',   /Office/],
    ['https://school.instructure.com/courses/1/files/2', /Canvas file/],
  ]
  for (const [src, pattern] of cases) {
    assert.match(describeEmbed(src).label, pattern, src)
  }
})

test('a provider match is not fooled by a lookalike hostname', () => {
  // The anchored `(^|\.)` guard exists so evil-drive.google.com.attacker.test
  // does not read as Google Drive.
  const { label } = describeEmbed('https://drive.google.com.attacker.test/x')
  assert.match(label, /attacker\.test/)
  assert.doesNotMatch(label, /Google Drive/)
})

test('an unknown host is reported by hostname', () => {
  assert.match(describeEmbed('https://widgets.example.org/thing').label, /widgets\.example\.org/)
})

test('http embeds are flagged as stale — Canvas serves https, so they are blocked', () => {
  const { label, stale } = describeEmbed('http://widgets.example.org/thing')
  assert.match(label, /insecure http/)
  assert.equal(stale, true)
})

test('an https embed from a known provider is not stale', () => {
  assert.equal(describeEmbed('https://www.youtube.com/embed/abc').stale, false)
})

test('a protocol-relative source resolves against https, so it is not flagged', () => {
  const { label, stale } = describeEmbed('//www.youtube.com/embed/abc')
  assert.match(label, /YouTube/)
  assert.equal(stale, false)
})
