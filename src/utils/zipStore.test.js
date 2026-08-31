import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, createZip } from './zipStore.js'

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const END_OF_CENTRAL_DIR_SIG = 0x06054b50

test('crc32 matches known vectors', () => {
  const enc = new TextEncoder()
  assert.equal(crc32(new Uint8Array(0)), 0x00000000)
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926)
  assert.equal(crc32(enc.encode('The quick brown fox jumps over the lazy dog')), 0x414fa339)
})

test('createZip emits a valid end-of-central-directory record', () => {
  const zip = createZip([
    { name: 'a.txt', data: 'alpha' },
    { name: 'nested/b.xml', data: '<b/>' },
  ])
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)

  // EOCD is the last 22 bytes (no archive comment).
  const eocdOffset = zip.length - 22
  assert.equal(view.getUint32(eocdOffset, true), END_OF_CENTRAL_DIR_SIG)
  assert.equal(view.getUint16(eocdOffset + 8, true), 2, 'entries on disk')
  assert.equal(view.getUint16(eocdOffset + 10, true), 2, 'total entries')

  const centralDirSize = view.getUint32(eocdOffset + 12, true)
  const centralDirOffset = view.getUint32(eocdOffset + 16, true)
  assert.equal(centralDirOffset + centralDirSize, eocdOffset, 'central directory abuts EOCD')
})

test('createZip local headers carry stored method and correct crc/size', () => {
  const data = 'the danger zone is 41-135F'
  const zip = createZip([{ name: 'q.txt', data }])
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)

  assert.equal(view.getUint32(0, true), LOCAL_FILE_HEADER_SIG)
  assert.equal(view.getUint16(8, true), 0, 'method 0 (stored)')
  assert.equal(view.getUint32(14, true), crc32(new TextEncoder().encode(data)), 'crc32')
  const size = new TextEncoder().encode(data).length
  assert.equal(view.getUint32(18, true), size, 'compressed size')
  assert.equal(view.getUint32(22, true), size, 'uncompressed size')
  assert.equal(view.getUint16(26, true), 5, 'filename length')
})

test('createZip output is deterministic for identical input', () => {
  const entries = [{ name: 'x.xml', data: '<x>1</x>' }]
  assert.deepEqual(createZip(entries), createZip(entries))
})

test('createZip round-trips through `unzip -t`', t => {
  let unzipAvailable = true
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' })
  } catch {
    unzipAvailable = false
  }
  if (!unzipAvailable) {
    t.skip('unzip not on PATH')
    return
  }

  const dir = mkdtempSync(join(tmpdir(), 'zipstore-'))
  try {
    const zip = createZip([
      { name: 'imsmanifest.xml', data: '<manifest/>' },
      { name: 'quiz/quiz.xml', data: '<questestinterop/>' },
    ])
    const zipPath = join(dir, 'out.zip')
    writeFileSync(zipPath, zip)
    const result = execFileSync('unzip', ['-t', zipPath], { encoding: 'utf8' })
    assert.match(result, /No errors detected/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
