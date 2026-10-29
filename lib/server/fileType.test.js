import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectImageType } from './fileType.js'

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)])

test('mengenali JPEG, PNG, WEBP dari magic bytes', () => {
  assert.equal(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])).ext, '.jpg')
  assert.equal(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).ext, '.png')
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])
  assert.equal(detectImageType(webp).ext, '.webp')
})

test('teks biasa bukan gambar', () => {
  assert.equal(detectImageType(Buffer.from('hello')), null)
  assert.equal(detectImageType(Buffer.from('hello world, ini bukan gambar')), null)
})
