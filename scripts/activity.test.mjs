import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGithubCalendar, countByDay, merge, trim, findRepos, commitLines } from './activity.mjs';

// Shapes copied from github.com/users/<u>/contributions (Sep 2026).
const cell = (i, date) =>
  `<td tabindex="0" data-ix="${i}" style="width: 11px" data-date="${date}" id="contribution-day-component-0-${i}" data-level="0" role="gridcell" class="ContributionCalendar-day"></td>`;
const tip = (i, text) =>
  `<tool-tip style="pointer-events: none;" id="tooltip-${i}" for="contribution-day-component-0-${i}" popover="manual" class="sr-only position-absolute">${text}</tool-tip>`;

test('parseGithubCalendar maps tooltip counts to cell dates', () => {
  const html =
    cell(0, '2026-09-27') + cell(1, '2026-09-28') + cell(2, '2026-09-29') +
    tip(0, 'No contributions on September 27th.') +
    tip(1, '1 contribution on September 28th.') +
    tip(2, '1,204 contributions on September 29th.');
  assert.deepEqual(parseGithubCalendar(html), { '2026-09-27': 0, '2026-09-28': 1, '2026-09-29': 1204 });
});

test('parseGithubCalendar throws when markup has no days', () => {
  assert.throws(() => parseGithubCalendar('<html><body>login</body></html>'), /no days parsed/);
});

test('countByDay dedupes a sha seen in two clones and ignores blank lines', () => {
  const lines = ['a1 2026-09-28', 'b2 2026-09-28', 'a1 2026-09-28', 'c3 2026-09-27', ''];
  assert.deepEqual(countByDay(lines), { '2026-09-28': 2, '2026-09-27': 1 });
});

test('merge adds counts per day', () => {
  assert.deepEqual(merge({ x: 1, y: 2 }, { y: 3, z: 4 }), { x: 1, y: 5, z: 4 });
});

test('trim keeps the window ending today, drops zeros, sorts', () => {
  const days = { '2026-09-29': 9, '2026-09-28': 3, '2026-09-27': 0, '2026-09-26': 2, '2026-09-25': 1 };
  assert.deepEqual(Object.entries(trim(days, '2026-09-28', 3)), [['2026-09-26', 2], ['2026-09-28', 3]]);
});

test('parseGithubCalendar throws on an unrecognised tooltip instead of storing 0', () => {
  const html = cell(0, '2026-09-28') + tip(0, '5 commits on September 28th.');
  assert.throws(() => parseGithubCalendar(html), /unrecognised tooltip/);
});

test('findRepos throws when a scan root is unreadable instead of returning no repos', () => {
  assert.throws(() => findRepos('/definitely/not/a/real/root'), /ENOENT/);
});

test('commitLines ignores stash commits and buckets days in Istanbul time whatever the machine zone', () => {
  const repo = mkdtempSync(join(tmpdir(), 'activity-'));
  const sh = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=avazedu@gmail.com', ...args], { env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  // yesterday 22:30 UTC is already the next day in Istanbul (UTC+3)
  const d = new Date(Date.now() - 86400000); d.setUTCHours(22, 30, 0, 0);
  const when = d.toISOString();
  const istanbulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
  sh('init', '-q');
  writeFileSync(join(repo, 'a.txt'), '1');
  sh('add', '.'); sh('commit', '-q', '-m', 'one');
  writeFileSync(join(repo, 'a.txt'), '2');
  sh('stash', '-q');
  const zone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.deepEqual(countByDay(commitLines(repo)), { [istanbulDay]: 1 });
  } finally {
    process.env.TZ = zone;
    rmSync(repo, { recursive: true, force: true });
  }
});
