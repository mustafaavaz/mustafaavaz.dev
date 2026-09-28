const DAY = 86400000;
const toTime = (date) => Date.parse(`${date}T00:00:00Z`);
const toDate = (time) => new Date(time).toISOString().slice(0, 10);

// Like GitHub: 0 stays 0, non-zero counts are bucketed by quartiles.
export function levels(counts) {
  const nz = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => nz[Math.floor((nz.length - 1) * p)];
  return (c) => (c <= 0 ? 0 : c <= q(0.25) ? 1 : c <= q(0.5) ? 2 : c <= q(0.75) ? 3 : 4);
}

const WEEKS_BACK = 26; // ~6 months

// WEEKS_BACK + 1 week columns (Sunday-first) ending on `today`.
export function buildGrid(days, today, locale = 'en-US') {
  const end = toTime(today);
  const start = end - (WEEKS_BACK * 7 + new Date(end).getUTCDay()) * DAY;
  const all = [];
  for (let t = start; t <= end; t += DAY) all.push({ date: toDate(t), count: days[toDate(t)] ?? 0 });

  const level = levels(all.map((d) => d.count));
  const weeks = [];
  all.forEach((d, i) => (weeks[Math.floor(i / 7)] ??= []).push({ ...d, level: level(d.count) }));

  const months = [];
  weeks.forEach((w, i) => {
    const month = w[0].date.slice(0, 7);
    if (i === 0 || month !== weeks[i - 1][0].date.slice(0, 7)) {
      months.push({ col: i, label: new Date(toTime(w[0].date)).toLocaleString(locale, { month: 'short', timeZone: 'UTC' }) });
    }
  });
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift();
  if (months.length > 1 && weeks.length - months.at(-1).col < 3) months.pop();

  return { weeks, months, total: all.reduce((sum, d) => sum + d.count, 0) };
}
