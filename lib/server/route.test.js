import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withAuth } from './route.js'

test('tanpa header Authorization dibalas 401 dan handler tidak dipanggil', async () => {
  let called = false
  const route = withAuth(async () => {
    called = true
    return {}
  })
  const res = await route(new Request('http://localhost/api/ai/parse-transaction', { method: 'POST' }))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'Harus login dulu.' })
  assert.equal(called, false)
})

test('skema selain Bearer dibalas 401', async () => {
  const route = withAuth(async () => ({}))
  const req = new Request('http://localhost/x', { method: 'POST', headers: { Authorization: 'Basic abc' } })
  assert.equal((await route(req)).status, 401)
})
