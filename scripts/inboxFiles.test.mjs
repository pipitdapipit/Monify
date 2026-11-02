import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { isInboxImage, isStable, listInbox, moveTo, uniqueName } from './inboxFiles.mjs'

let root
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'monify-inbox-'))
})
after(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

// Folder baru per test supaya tidak saling memengaruhi
async function dir(name) {
  const d = path.join(root, name)
  await fs.mkdir(d, { recursive: true })
  return d
}

test('hanya gambar yang diproses', () => {
  assert.equal(isInboxImage('a.PNG'), true)
  assert.equal(isInboxImage('b.jpeg'), true)
  assert.equal(isInboxImage('c.pdf'), false)
  assert.equal(isInboxImage('d.png.tmp'), false)
})

test('listInbox mengabaikan subfolder dan file lain', async () => {
  const d = await dir('list')
  await fs.writeFile(path.join(d, 'a.png'), 'x')
  await fs.writeFile(path.join(d, 'b.txt'), 'x')
  await fs.mkdir(path.join(d, 'selesai'))
  await fs.writeFile(path.join(d, 'selesai', 'x.png'), 'x')
  assert.deepEqual(await listInbox(d), ['a.png'])
})

test('nama bentrok diberi akhiran, termasuk txt', async () => {
  const d1 = await dir('unique1')
  await fs.writeFile(path.join(d1, 'bca.png'), 'x')
  assert.equal(await uniqueName(d1, 'bca.png'), 'bca (2).png')

  const d2 = await dir('unique2')
  await fs.writeFile(path.join(d2, 'bca.txt'), 'x')
  assert.equal(await uniqueName(d2, 'bca.png'), 'bca (2).png')
})

test('moveTo menulis alasan dengan nama yang sama', async () => {
  const src = await dir('move-src')
  const dest = await dir('move-dest')
  await fs.writeFile(path.join(src, 'bca.png'), 'baru')
  await fs.writeFile(path.join(dest, 'bca.png'), 'lama')

  const final = await moveTo(src, 'bca.png', dest, 'alasan')
  assert.equal(final, 'bca (2).png')
  assert.equal(await fs.readFile(path.join(dest, 'bca (2).png'), 'utf8'), 'baru')
  assert.equal(await fs.readFile(path.join(dest, 'bca (2).txt'), 'utf8'), 'alasan')
  assert.equal(await fs.readFile(path.join(dest, 'bca.png'), 'utf8'), 'lama')
})

test('file hilang saat dipindah -> error ENOENT', async () => {
  const src = await dir('gone-src')
  const dest = await dir('gone-dest')
  await assert.rejects(moveTo(src, 'tidak-ada.png', dest), { code: 'ENOENT' })
})

test('isStable: stabil setelah ukuran sama dua kali', async () => {
  const d = await dir('stable')
  const file = path.join(d, 'a.png')
  await fs.writeFile(file, 'abc')
  const first = await isStable(file, undefined)
  assert.equal(first.stable, false)
  const second = await isStable(file, first.size)
  assert.equal(second.stable, true)
})
