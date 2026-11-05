import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { HttpError } from './errors.js'
import { withApiKey, withAuth } from './route.js'

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

// ---------- withApiKey (iPhone Shortcut) ----------

const lists = { wallets: [{ id: 'w1', name: 'BCA' }], categories: [] }
const invalidKey = 'API key tidak valid. Buat key baru di Pengaturan Monify.'

// Client palsu: rpc api_key_lists mengembalikan `result` dan merekam argumennya.
function fakeClientFactory(result = { data: lists, error: null }) {
  const factory = () => {
    factory.created++
    return {
      rpc: async (name, args) => {
        factory.rpcCalls.push([name, args])
        return result
      },
    }
  }
  factory.created = 0
  factory.rpcCalls = []
  return factory
}

const keyRequest = (authorization) =>
  new Request('http://localhost/api/import/bank-screenshot', {
    method: 'POST',
    headers: authorization === undefined ? {} : { Authorization: authorization },
  })

test('withApiKey: tanpa header -> 401 dengan message, createClient tidak dipanggil', async () => {
  const createClient = fakeClientFactory()
  const route = withApiKey(async () => ({}), { createClient })
  const res = await route(keyRequest())
  assert.equal(res.status, 401)
  assert.equal((await res.json()).message, invalidKey)
  assert.equal(createClient.created, 0)
})

test('withApiKey: key tanpa awalan mnf_ -> 401', async () => {
  const createClient = fakeClientFactory()
  const res = await withApiKey(async () => ({}), { createClient })(keyRequest('Bearer eyJhbGciOi'))
  assert.equal(res.status, 401)
  assert.equal(createClient.created, 0)
})

test('withApiKey: "bearer" huruf kecil dan spasi/newline di ujung tetap diterima', async () => {
  const createClient = fakeClientFactory()
  const res = await withApiKey(async () => ({ ok: true }), { createClient })(keyRequest('bearer mnf_abc \n'))
  assert.equal(res.status, 200)
  assert.deepEqual(createClient.rpcCalls, [['api_key_lists', { p_key: 'mnf_abc' }]])
})

test('withApiKey: rpc 28000 -> 401 dengan pesan API key tidak valid', async () => {
  const createClient = fakeClientFactory({ data: null, error: { code: '28000', message: 'invalid api key' } })
  const res = await withApiKey(async () => ({}), { createClient })(keyRequest('Bearer mnf_abc'))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: invalidKey, message: invalidKey })
})

test('withApiKey: rpc error lain -> 502', async () => {
  const createClient = fakeClientFactory({ data: null, error: { code: 'XX000', message: 'boom' } })
  const res = await withApiKey(async () => ({}), { createClient })(keyRequest('Bearer mnf_abc'))
  assert.equal(res.status, 502)
  assert.equal((await res.json()).message, 'Gagal mengambil data dompet / kategori.')
})

test('withApiKey: limiter menerima hash, bukan key asli; ditolak -> 429 dengan message', async () => {
  const seen = []
  const limiter = (k) => (seen.push(k), false)
  const route = withApiKey(async () => ({}), {
    limiter,
    limitMessage: 'Terlalu banyak screenshot. Coba lagi sebentar lagi.',
    createClient: fakeClientFactory(),
  })
  const res = await route(keyRequest('Bearer mnf_abc'))
  assert.equal(res.status, 429)
  assert.equal((await res.json()).message, 'Terlalu banyak screenshot. Coba lagi sebentar lagi.')
  assert.deepEqual(seen, [createHash('sha256').update('mnf_abc').digest('hex')])
})

test('withApiKey: handler menerima lists dan key, hasil dikirim 200', async () => {
  let ctx
  const route = withApiKey(
    async (_req, c) => {
      ctx = c
      return { status: 'saved', message: 'ok' }
    },
    { createClient: fakeClientFactory() },
  )
  const res = await route(keyRequest('Bearer mnf_abc'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'saved', message: 'ok' })
  assert.equal(ctx.key, 'mnf_abc')
  assert.deepEqual(ctx.lists, lists)
  assert.equal(typeof ctx.supabase.rpc, 'function')
})

test('withApiKey: HttpError dari handler diteruskan; error lain -> 500', async () => {
  const createClient = fakeClientFactory()
  const httpErr = withApiKey(
    async () => {
      throw new HttpError(413, 'Ukuran gambar maksimal 4 MB.')
    },
    { createClient },
  )
  const r1 = await httpErr(keyRequest('Bearer mnf_abc'))
  assert.equal(r1.status, 413)
  assert.equal((await r1.json()).message, 'Ukuran gambar maksimal 4 MB.')

  const crash = withApiKey(
    async () => {
      throw new TypeError('x is undefined')
    },
    { createClient },
  )
  const r2 = await crash(keyRequest('Bearer mnf_abc'))
  assert.equal(r2.status, 500)
  assert.equal((await r2.json()).message, 'Terjadi kesalahan di server.')
})
