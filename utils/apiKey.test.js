import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { generateApiKey } from './apiKey.js'

test('key berawalan mnf_ dan panjang 47, hanya karakter base64url', async () => {
  const { key } = await generateApiKey()
  assert.equal(key.length, 47)
  assert.match(key, /^mnf_[A-Za-z0-9_-]{43}$/)
})

test('prefix = 12 karakter pertama key', async () => {
  const { key, prefix } = await generateApiKey()
  assert.equal(prefix, key.slice(0, 12))
})

test('hash = sha256 hex dari key', async () => {
  const { key, hash } = await generateApiKey()
  assert.equal(hash, createHash('sha256').update(key).digest('hex'))
})

test('dua panggilan menghasilkan key berbeda', async () => {
  const [a, b] = await Promise.all([generateApiKey(), generateApiKey()])
  assert.notEqual(a.key, b.key)
})
