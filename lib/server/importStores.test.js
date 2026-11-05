import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HttpError } from './errors.js'
import { apiKeyStore, supabaseStore } from './importStores.js'

const rows = [{ date: '2026-11-02', type: 'expense', amount: 25000, note: 'Kopi', category_id: 'c1' }]
const range = { walletId: 'w1', from: '2026-11-01', to: '2026-11-03' }

// Client palsu: merekam setiap panggilan query builder / rpc.
function fakeClient({ data = [], error = null } = {}) {
  const calls = []
  const query = {
    select: (...a) => (calls.push(['select', ...a]), query),
    eq: (...a) => (calls.push(['eq', ...a]), query),
    gte: (...a) => (calls.push(['gte', ...a]), query),
    lte: (...a) => (calls.push(['lte', ...a]), Promise.resolve({ data, error })),
    insert: (r) => (calls.push(['insert', r]), Promise.resolve({ error })),
  }
  return {
    calls,
    from: (t) => (calls.push(['from', t]), query),
    rpc: (name, args) => (calls.push(['rpc', name, args]), Promise.resolve({ data, error })),
  }
}

test('supabaseStore findExisting memfilter dompet dan rentang tanggal', async () => {
  const existing = [{ date: '2026-11-02', type: 'expense', amount: 25000 }]
  const client = fakeClient({ data: existing })
  assert.deepEqual(await supabaseStore(client).findExisting(range), existing)
  assert.deepEqual(client.calls, [
    ['from', 'transactions'],
    ['select', 'date, type, amount'],
    ['eq', 'wallet_id', 'w1'],
    ['gte', 'date', '2026-11-01'],
    ['lte', 'date', '2026-11-03'],
  ])
})

test('supabaseStore insert menambah wallet_id dan source', async () => {
  const client = fakeClient()
  await supabaseStore(client).insert({ walletId: 'w1', rows })
  assert.deepEqual(client.calls, [
    ['from', 'transactions'],
    ['insert', [{ ...rows[0], wallet_id: 'w1', source: 'ai_receipt' }]],
  ])
})

test('apiKeyStore findExisting memanggil api_key_existing', async () => {
  const existing = [{ date: '2026-11-02', type: 'expense', amount: 25000 }]
  const client = fakeClient({ data: existing })
  assert.deepEqual(await apiKeyStore(client, 'mnf_x').findExisting(range), existing)
  assert.deepEqual(client.calls, [
    ['rpc', 'api_key_existing', { p_key: 'mnf_x', p_wallet_id: 'w1', p_from: '2026-11-01', p_to: '2026-11-03' }],
  ])
})

test('apiKeyStore insert memanggil api_key_insert_transactions', async () => {
  const client = fakeClient({ data: 1 })
  await apiKeyStore(client, 'mnf_x').insert({ walletId: 'w1', rows })
  assert.deepEqual(client.calls, [
    ['rpc', 'api_key_insert_transactions', { p_key: 'mnf_x', p_wallet_id: 'w1', p_rows: rows }],
  ])
})

const readError = { status: 502, message: 'Gagal mengambil transaksi yang sudah ada.' }
const saveError = { status: 502, message: 'Gagal menyimpan transaksi.' }
const failing = () => fakeClient({ error: { code: 'XX000', message: 'boom' } })

test('error Supabase jadi HttpError 502', async () => {
  const cases = [
    [() => supabaseStore(failing()).findExisting(range), readError],
    [() => supabaseStore(failing()).insert({ walletId: 'w1', rows }), saveError],
    [() => apiKeyStore(failing(), 'mnf_x').findExisting(range), readError],
    [() => apiKeyStore(failing(), 'mnf_x').insert({ walletId: 'w1', rows }), saveError],
  ]
  for (const [call, expected] of cases) {
    await assert.rejects(call, (err) => {
      assert.ok(err instanceof HttpError)
      assert.equal(err.status, expected.status)
      assert.equal(err.message, expected.message)
      return true
    })
  }
})
