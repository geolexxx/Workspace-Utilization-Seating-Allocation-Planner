/**
 * Synthetic workspace dataset generator.
 *
 * Simulates 12 weeks of badge-swipe occupancy for a fictional Americas office.
 * All output is fully reproducible: same SEED → same JSON every time.
 *
 * Model:
 *   daily_presence(team, week, day) ~ Binomial(headcount, in_office_rate × dow_weight[day])
 *   in_office_rate = in_office_days / 5
 *   dow_weight = [Mon=0.85, Tue=1.15, Wed=1.23, Thu=1.07, Fri=0.70]  (mean ≈ 1.0)
 *
 * Effective demand (peak_demand / peak_util) = 95th-percentile concurrent presence.
 * Planning to the peak, not the average, is the key modeling decision in this project.
 *
 * Run:  npm run gen
 * Output: src/data/workspace.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
// No external deps. Same seed → same sequence → same dataset.
function mulberry32(seed: number): () => number {
  let s = seed;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Statistics helpers ────────────────────────────────────────────────────────
function binomial(n: number, p: number, rand: () => number): number {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (rand() < p) count++;
  }
  return count;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

// ── Configuration ─────────────────────────────────────────────────────────────
const SEED  = 42;
const WEEKS = 12;

// Day-of-week attendance multipliers (Mon–Fri). Mean = 1.0 so the weekly
// average equals the team's stated in_office_days / 5.
// Calibrated to reproduce the midweek peak / Friday collapse profile.
const DOW_WEIGHTS = [0.85, 1.15, 1.23, 1.07, 0.70];

const TEAM_CONFIG = [
  { name: 'Trust & Safety',     headcount: 58, in_office_days: 4.0, home: 'L3-A' },
  { name: 'Monetization Eng',   headcount: 44, in_office_days: 3.5, home: 'L3-A' },
  { name: 'Creator Growth',     headcount: 31, in_office_days: 2.5, home: 'L2-A' },
  { name: 'Data Platform',      headcount: 39, in_office_days: 3.0, home: 'L5-A' },
  { name: 'Product Design',     headcount: 22, in_office_days: 3.0, home: 'L5-B' },
  { name: 'Commercial / Sales', headcount: 48, in_office_days: 2.0, home: 'L2-A' },
  { name: 'Legal & Policy',     headcount: 18, in_office_days: 3.5, home: 'L2-B' },
  { name: 'Recruiting / HR',    headcount: 16, in_office_days: 4.0, home: 'L6-B' },
  { name: 'Finance / BizOps',   headcount: 21, in_office_days: 3.0, home: 'L6-A' },
  { name: 'Infra / SRE',        headcount: 34, in_office_days: 2.5, home: 'L5-A' },
  { name: 'Marketing',          headcount: 19, in_office_days: 2.0, home: 'L6-A' },
  { name: 'PMO',                headcount: 12, in_office_days: 4.0, home: 'L3-B' },
] as const;

const NEIGHBORHOOD_CONFIG = [
  { id: 'L2-A', floor: 'L2', zone: 'North Open',   desks: 64 },
  { id: 'L2-B', floor: 'L2', zone: 'North Quiet',  desks: 40 },
  { id: 'L3-A', floor: 'L3', zone: 'Central Hub',  desks: 88 },
  { id: 'L3-B', floor: 'L3', zone: 'Central Pods', desks: 48 },
  { id: 'L5-A', floor: 'L5', zone: 'South Open',   desks: 72 },
  { id: 'L5-B', floor: 'L5', zone: 'South Collab', desks: 36 },
  { id: 'L6-A', floor: 'L6', zone: 'Annex Flex',   desks: 56 },
  { id: 'L6-B', floor: 'L6', zone: 'Annex Focus',  desks: 30 },
] as const;

// ── Simulation ────────────────────────────────────────────────────────────────
function generate() {
  const rand = mulberry32(SEED);

  // Step 1: simulate each team's daily presence [team][week][day]
  const teamDaily: number[][][] = TEAM_CONFIG.map(team => {
    const rate = team.in_office_days / 5;
    return Array.from({ length: WEEKS }, () =>
      DOW_WEIGHTS.map(w => binomial(team.headcount, Math.min(rate * w, 1), rand))
    );
  });

  // Step 2: aggregate by zone [zoneId][week][day]
  const zoneMap: Record<string, number[][]> = Object.fromEntries(
    NEIGHBORHOOD_CONFIG.map(n => [
      n.id,
      Array.from({ length: WEEKS }, () => new Array<number>(5).fill(0)),
    ])
  );

  TEAM_CONFIG.forEach((team, ti) => {
    const zd = zoneMap[team.home];
    if (!zd) throw new Error(`No zone for team home: ${team.home}`);
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 5; d++) {
        zd[w][d] += teamDaily[ti][w][d];
      }
    }
  });

  // Step 3: compute neighborhood statistics
  const total_desks      = NEIGHBORHOOD_CONFIG.reduce((s, n) => s + n.desks, 0);
  const total_headcount  = TEAM_CONFIG.reduce((s, t) => s + t.headcount, 0);

  const neighborhoods = NEIGHBORHOOD_CONFIG.map(n => {
    const allDays   = zoneMap[n.id].flat();
    const avg_util  = round4(mean(allDays) / n.desks);
    const peak_util = round4(percentile(allDays, 95) / n.desks);
    const assigned_hc = TEAM_CONFIG
      .filter(t => t.home === n.id)
      .reduce((s, t) => s + t.headcount, 0);
    return { id: n.id, floor: n.floor, zone: n.zone, desks: n.desks,
             avg_util, peak_util, assigned_hc };
  });

  // Step 4: compute team demand (95th-pct peak presence = "peak seats")
  const team_demand: Record<string, {
    headcount: number; peak_demand: number;
    in_office_days: number; home: string;
  }> = {};
  TEAM_CONFIG.forEach((team, ti) => {
    team_demand[team.name] = {
      headcount:      team.headcount,
      peak_demand:    percentile(teamDaily[ti].flat(), 95),
      in_office_days: team.in_office_days,
      home:           team.home,
    };
  });

  // Step 5: portfolio-level weekly trend (mean daily util across the week)
  const weekly_trend = Array.from({ length: WEEKS }, (_, w) => {
    const weekDailyUtil = [0, 1, 2, 3, 4].map(d => {
      const tot = NEIGHBORHOOD_CONFIG.reduce((s, n) => s + zoneMap[n.id][w][d], 0);
      return tot / total_desks;
    });
    return { week: w + 1, util: round4(mean(weekDailyUtil)) };
  });

  // Step 6: day-of-week profile (mean across all weeks)
  const dow_profile = [0, 1, 2, 3, 4].map(d => {
    const dailyUtil = Array.from({ length: WEEKS }, (_, w) => {
      const tot = NEIGHBORHOOD_CONFIG.reduce((s, n) => s + zoneMap[n.id][w][d], 0);
      return tot / total_desks;
    });
    return { dow: d, util: round4(mean(dailyUtil)) };
  });

  return {
    meta: {
      total_desks,
      total_headcount,
      weeks: WEEKS,
      nominal_ratio: round4(total_headcount / total_desks),
      seed: SEED,
      generated_at: new Date().toISOString(),
    },
    neighborhoods,
    team_demand,
    weekly_trend,
    dow_profile,
  };
}

// ── Output ────────────────────────────────────────────────────────────────────
const data = generate();

console.log('\n── Synthetic dataset (seed=%d) ─────────────────────────────', data.meta.seed);
console.log(`Desks: ${data.meta.total_desks}  HC: ${data.meta.total_headcount}  `
  + `Nominal ratio: ${(data.meta.nominal_ratio * 100).toFixed(1)}%`);
console.log('\nNeighborhoods:');
data.neighborhoods.forEach(n => {
  const over = n.peak_util > 1 ? '  ← OVER CAPACITY' : '';
  console.log(
    `  ${n.id.padEnd(6)} ${n.zone.padEnd(16)} `
    + `avg ${(n.avg_util * 100).toFixed(1).padStart(5)}%  `
    + `peak ${(n.peak_util * 100).toFixed(1).padStart(6)}%${over}`
  );
});
const avgUtil = data.weekly_trend.reduce((s, w) => s + w.util, 0) / data.weekly_trend.length;
console.log(`\nPortfolio avg util: ${(avgUtil * 100).toFixed(1)}%`);
console.log('─'.repeat(60));

const outDir = join(__dirname, '..', 'src', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'workspace.json'), JSON.stringify(data, null, 2));
console.log('✓  Wrote src/data/workspace.json\n');
