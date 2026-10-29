import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createLimiter } from './rateLimit.js'

const realNow = Date.now
afterEach(() => {
  Date.now = realNow
})

test('menolak permintaan ke-3 dalam satu jendela, per key', () => {
  Date.now = () => 1_000
  const allow = createLimiter({ limit: 2, windowMs: 1000 })
  assert.equal(allow('u1'), true)
  assert.equal(allow('u1'), true)
  assert.equal(allow('u1'), false)
  assert.equal(allow('u2'), true)
})

test('jendela baru setelah windowMs lewat', () => {
  Date.now = () => 1_000
  const allow = createLimiter({ limit: 2, windowMs: 1000 })
  allow('u1')
  allow('u1')
  assert.equal(allow('u1'), false)
  Date.now = () => 2_000
  assert.equal(allow('u1'), true)
})
