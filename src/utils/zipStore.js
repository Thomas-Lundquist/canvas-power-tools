// Pure, zero-dependency ZIP writer. Stored (uncompressed) entries only —
// method 0, no DEFLATE. QTI packages are a handful of small XML files, so
// compression buys nothing and a stored archive keeps this module tiny and
// auditable (CLAUDE.md: no new dependencies, no external code).
//
//   createZip([{ name: 'imsmanifest.xml', data: '<xml.../>' },
//              { name: 'quiz/quiz.xml',    data: uint8array }]) -> Uint8Array
//
// `data` may be a string (encoded UTF-8) or a Uint8Array. `name` is always
// stored UTF-8 with the language-encoding flag set (bit 11). The result is a
// complete archive: local file headers, then the central directory, then the
// end-of-central-directory record.

const LOCAL_FILE_HEADER_SIG = 0x04034b50
const CENTRAL_DIRECTORY_SIG = 0x02014b50
const END_OF_CENTRAL_DIR_SIG = 0x06054b50

// Fixed MS-DOS timestamp (1980-01-01 00:00:00) — archives are content-addressed
// by the caller, so a stable mtime keeps byte output deterministic.
const DOS_TIME = 0
const DOS_DATE = 0x0021

// Bit 11 — filename and comment are UTF-8.
const FLAG_UTF8 = 0x0800

const textEncoder = new TextEncoder()

const CRC32_TABLE = buildCrc32Table()

function buildCrc32Table() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
}

export function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toBytes(data) {
  return typeof data === 'string' ? textEncoder.encode(data) : data
}

export function createZip(entries) {
  const files = entries.map(entry => {
    const nameBytes = textEncoder.encode(entry.name)
    const dataBytes = toBytes(entry.data)
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      size: dataBytes.length,
    }
  })

  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const localHeader = new DataView(new ArrayBuffer(30))
    localHeader.setUint32(0, LOCAL_FILE_HEADER_SIG, true)
    localHeader.setUint16(4, 20, true) // version needed to extract (2.0)
    localHeader.setUint16(6, FLAG_UTF8, true)
    localHeader.setUint16(8, 0, true) // method 0 — stored
    localHeader.setUint16(10, DOS_TIME, true)
    localHeader.setUint16(12, DOS_DATE, true)
    localHeader.setUint32(14, file.crc, true)
    localHeader.setUint32(18, file.size, true) // compressed size == size
    localHeader.setUint32(22, file.size, true) // uncompressed size
    localHeader.setUint16(26, file.nameBytes.length, true)
    localHeader.setUint16(28, 0, true) // extra field length

    localParts.push(new Uint8Array(localHeader.buffer), file.nameBytes, file.dataBytes)

    const centralHeader = new DataView(new ArrayBuffer(46))
    centralHeader.setUint32(0, CENTRAL_DIRECTORY_SIG, true)
    centralHeader.setUint16(4, 20, true) // version made by
    centralHeader.setUint16(6, 20, true) // version needed to extract
    centralHeader.setUint16(8, FLAG_UTF8, true)
    centralHeader.setUint16(10, 0, true) // method 0 — stored
    centralHeader.setUint16(12, DOS_TIME, true)
    centralHeader.setUint16(14, DOS_DATE, true)
    centralHeader.setUint32(16, file.crc, true)
    centralHeader.setUint32(20, file.size, true)
    centralHeader.setUint32(24, file.size, true)
    centralHeader.setUint16(28, file.nameBytes.length, true)
    centralHeader.setUint16(30, 0, true) // extra field length
    centralHeader.setUint16(32, 0, true) // comment length
    centralHeader.setUint16(34, 0, true) // disk number start
    centralHeader.setUint16(36, 0, true) // internal attributes
    centralHeader.setUint32(38, 0, true) // external attributes
    centralHeader.setUint32(42, offset, true) // local header offset

    centralParts.push(new Uint8Array(centralHeader.buffer), file.nameBytes)

    offset += 30 + file.nameBytes.length + file.dataBytes.length
  }

  const centralDirOffset = offset
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0)

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, END_OF_CENTRAL_DIR_SIG, true)
  end.setUint16(4, 0, true) // this disk number
  end.setUint16(6, 0, true) // disk with central directory
  end.setUint16(8, files.length, true) // entries on this disk
  end.setUint16(10, files.length, true) // total entries
  end.setUint32(12, centralDirSize, true)
  end.setUint32(16, centralDirOffset, true)
  end.setUint16(20, 0, true) // comment length

  return concatBytes([...localParts, ...centralParts, new Uint8Array(end.buffer)])
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const part of parts) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
