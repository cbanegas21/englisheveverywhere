import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('src/app/icon.svg')
// Render the brand mark to 32x32 PNG, then wrap it in a minimal ICO container
// (modern browsers accept PNG-encoded ICO entries).
const png = await sharp(svg).resize(32, 32).png().toBuffer()
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
const dir = Buffer.alloc(16)
dir.writeUInt8(32, 0); dir.writeUInt8(32, 1); dir.writeUInt8(0, 2); dir.writeUInt8(0, 3)
dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6)
dir.writeUInt32LE(png.length, 8); dir.writeUInt32LE(22, 12)
writeFileSync('src/app/favicon.ico', Buffer.concat([header, dir, png]))
console.log('wrote src/app/favicon.ico (' + (22 + png.length) + ' bytes, 32x32 PNG-in-ICO)')
