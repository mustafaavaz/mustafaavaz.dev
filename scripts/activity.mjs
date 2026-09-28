// Counts own commits per day from local non-GitHub repos (GitLab work) plus
// GitHub's public calendar, and writes src/data/activity.json for the heatmap.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EMAILS = ['avazedu@gmail.com'];
const GITHUB_USER = 'mustafaavaz';
const ROOTS = [join(homedir(), 'Desktop')];
const MAX_DEPTH = 3;
const WINDOW_DAYS = 371;
const OUT = fileURLToPath(new URL('../src/data/activity.json', import.meta.url));

export function parseGithubCalendar(html) {
  const dateById = {};
  for (const [tag] of html.matchAll(/<td\b[^>]*\bdata-date="[^"]+"[^>]*>/g)) {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (id) dateById[id] = tag.match(/data-date="([^"]+)"/)[1];
  }
  const days = {};
  for (const [, id, text] of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    if (!dateById[id]) continue;
    const n = text.match(/^([\d,]+) contributions?/);
    if (!n && !/^No contributions/.test(text)) throw new Error(`GitHub calendar: unrecognised tooltip "${text}"`);
    days[dateById[id]] = n ? Number(n[1].replaceAll(',', '')) : 0;
  }
  if (Object.keys(days).length === 0) throw new Error('GitHub calendar: no days parsed (markup changed?)');
  return days;
}

export function countByDay(lines) {
  const seen = new Set();
  const days = {};
  for (const line of lines) {
    const [sha, date] = line.trim().split(' ');
    if (!sha || !date || seen.has(sha)) continue;
    seen.add(sha);
    days[date] = (days[date] ?? 0) + 1;
  }
  return days;
}

export function merge(a, b) {
  const out = { ...a };
  for (const [day, n] of Object.entries(b)) out[day] = (out[day] ?? 0) + n;
  return out;
}

export function trim(days, today, windowDays = WINDOW_DAYS) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (windowDays - 1) * 86400000).toISOString().slice(0, 10);
  return Object.fromEntries(
    Object.entries(days)
      .filter(([day, n]) => n > 0 && day >= from && day <= today)
      .sort(([x], [y]) => x.localeCompare(y)),
  );
}

export function findRepos(dir, depth = 0, out = []) {
  if (existsSync(join(dir, '.git'))) return out.push(dir), out;
  if (depth >= MAX_DEPTH) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (depth === 0) throw err; // an unreadable root would silently drop all local activity
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') findRepos(join(dir, e.name), depth + 1, out);
  }
  return out;
}

// TZ pinned so commit days match the Istanbul 'today' used for the window.
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args],
  { encoding: 'utf8', maxBuffer: 64 << 20, env: { ...process.env, TZ: 'Europe/Istanbul' } });

export function commitLines(repo) {
  // branches/remotes/tags only: --all would also count stash and refs/original commits
  return git(repo, 'log', '--branches', '--remotes', '--tags', `--since=${WINDOW_DAYS} days ago`, '--format=%H %ad',
    '--date=format-local:%Y-%m-%d', ...EMAILS.map((e) => `--author=${e}`)).split('\n');
}

function localLines() {
  const lines = [];
  for (const repo of ROOTS.flatMap((root) => findRepos(root))) {
    try {
      if (git(repo, 'remote', '-v').includes('github.com')) continue; // already on GitHub's calendar
      lines.push(...commitLines(repo));
    } catch (err) {
      console.warn(`skip ${repo}: ${err.message.split('\n')[0]}`);
    }
  }
  return lines;
}

async function main() {
  const res = await fetch(`https://github.com/users/${GITHUB_USER}/contributions`, {
    headers: { 'user-agent': 'mustafaavaz.dev activity script' },
  });
  if (!res.ok) throw new Error(`GitHub calendar: HTTP ${res.status}`);
  const github = parseGithubCalendar(await res.text());
  const local = countByDay(localLines());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const days = trim(merge(local, github), today);
  writeFileSync(OUT, JSON.stringify({ generatedAt: today, days }, null, 2) + '\n');
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  console.log(`activity: ${Object.keys(days).length} active days, ${sum(local)} local + ${sum(github)} GitHub`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
