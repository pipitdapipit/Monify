import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importMessage } from './importMessage.js'

const saved = (over) => ({ status: 'saved', wallet: 'BCA', inserted: 0, skipped: 0, dropped: 0, expense: 0, income: 0, ...over })

test('saved dengan duplikat', () => {
  assert.equal(
    importMessage(saved({ inserted: 3, skipped: 1, expense: 75000 })),
    '3 transaksi tersimpan ke BCA: keluar Rp 75.000 (1 duplikat dilewati)',
  )
})

test('saved tanpa duplikat', () => {
  assert.equal(importMessage(saved({ inserted: 1, expense: 25000 })), '1 transaksi tersimpan ke BCA: keluar Rp 25.000')
})

test('semua duplikat', () => {
  assert.equal(importMessage(saved({ skipped: 2 })), 'Tidak ada transaksi baru di BCA (2 duplikat dilewati)')
})

test('baris dibuang disebut', () => {
  assert.equal(
    importMessage(saved({ inserted: 2, dropped: 1, expense: 50000 })),
    '2 transaksi tersimpan ke BCA: keluar Rp 50.000 (1 baris dilewati karena tidak jelas)',
  )
})

test('duplikat dan baris dibuang dalam satu kurung', () => {
  assert.equal(
    importMessage(saved({ inserted: 2, skipped: 1, dropped: 3, income: 500000 })),
    '2 transaksi tersimpan ke BCA: masuk Rp 500.000 (1 duplikat dilewati, 3 baris dilewati karena tidak jelas)',
  )
})

test('keluar dan masuk sekaligus', () => {
  assert.equal(
    importMessage(saved({ inserted: 3, expense: 75000, income: 1000000 })),
    '3 transaksi tersimpan ke BCA: keluar Rp 75.000, masuk Rp 1.000.000',
  )
})

test('review', () => {
  assert.equal(
    importMessage({ status: 'review', reason: 'Bank "Jago" tidak ada di dompet Monify' }),
    'Perlu dicek: Bank "Jago" tidak ada di dompet Monify',
  )
})
