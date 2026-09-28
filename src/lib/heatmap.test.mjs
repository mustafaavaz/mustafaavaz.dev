import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, levels } from './heatmap.mjs';

test('grid ends today and starts on the Sunday 26 weeks back', () => {
  const { weeks } = buildGrid({}, '2026-09-28'); // a Monday
  assert.equal(weeks.length, 27);
  assert.equal(weeks[0][0].date, '2026-03-29');
  assert.equal(new Date('2026-03-29T00:00:00Z').getUTCDay(), 0);
  assert.equal(weeks.at(-1).at(-1).date, '2026-09-28');
  assert.equal(weeks.at(-1).length, 2);
});

test('total counts only days inside the window', () => {
  const { total } = buildGrid({ '2026-03-28': 50, '2026-03-29': 1, '2026-09-28': 2 }, '2026-09-28');
  assert.equal(total, 3);
});

test('levels: zero is 0, non-zero split by quartiles', () => {
  const level = levels([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(level), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('empty activity renders all level 0 without throwing', () => {
  const { weeks, total } = buildGrid({}, '2026-09-28');
  assert.equal(total, 0);
  assert.ok(weeks.flat().every((d) => d.level === 0));
});

test('month labels: cramped first label dropped, last is current month', () => {
  const { months } = buildGrid({}, '2026-09-28');
  assert.deepEqual(months[0], { col: 1, label: 'Apr' });
  assert.equal(months.at(-1).label, 'Sep');
});

test('month labels: a new month starting in the last columns is dropped instead of clipped', () => {
  const { weeks, months } = buildGrid({}, '2026-10-04'); // Oct starts in the last column
  assert.ok(weeks.length - months.at(-1).col >= 3);
  assert.equal(months.at(-1).label, 'Sep');
});

test('month labels follow the requested locale', () => {
  const { months } = buildGrid({}, '2026-09-28', 'tr-TR');
  assert.deepEqual(months.map((m) => m.label), ['Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl']);
});
