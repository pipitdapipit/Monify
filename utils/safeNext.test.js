import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeNext } from './safeNext.js'

test('path internal dipertahankan', () => {
  assert.equal(safeNext('/transactions'), '/transactions')
})

test('URL luar dan nilai aneh jadi "/"', () => {
  for (const value of ['//evil.com', 'https://evil.com', null, 'abc', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com']) {
    assert.equal(safeNext(value), '/', String(value))
  }
})

test('query dan hash di path internal dipertahankan', () => {
  assert.equal(safeNext('/transactions?wallet=1#top'), '/transactions?wallet=1#top')
})
