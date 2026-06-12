import { useState, useMemo } from 'react';
import { C, pct } from './lib/theme';
import { runAllocation } from './lib/allocation';
import { KpiRow }            from './components/KpiRow';
import { TrendChart }        from './components/TrendChart';
import { DowChart }          from './components/DowChart';
import { NeighborhoodChart } from './components/NeighborhoodChart';
import { MovesPanel }        from './components/MovesPanel';
import { OutcomePanel }      from './components/OutcomePanel';
import rawData from './data/workspace.json';
import type { WorkspaceData } from './types';

const data = rawData as WorkspaceData;

const portfolioAvgUtil = data.weekly_trend.reduce((s, w) => s + w.util, 0) / data.weekly_trend.length;
const hotspot = data.neighborhoods.reduce(
  (max, n) => (n.peak_util > max.peak_util ? n : max),
  data.neighborhoods[0]
);
const underusedCount = data.neighborhoods.filter(n => n.avg_util < 0.40).length;

export default function App() {
  const [cap, setCap]             = useState(0.85);
  const [showAfter, setShowAfter] = useState(false);

  const result = useMemo(() => runAllocation(data, cap), [cap]);

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      color: C.ink,
      background: C.paper,
      minHeight: '100%',
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.blue,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              Real Estate Planning · AMS Portfolio
            </span>
            <span style={{
              fontSize: 11,
              background: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FDE68A',
              borderRadius: 4,
              padding: '1px 7px',
              fontWeight: 500,
            }}>
              Synthetic demo data
            </span>
          </div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            margin: '0 0 4px',
            letterSpacing: -0.3,
            color: C.ink,
          }}>
            Workspace Utilization &amp; Seating Allocation
          </h1>
          <p style={{ fontSize: 14, color: C.sub, margin: 0 }}>
            {data.meta.weeks} weeks of building-access occupancy data
            &nbsp;·&nbsp; {data.neighborhoods.length} neighborhoods across 4 floors
            &nbsp;·&nbsp; {Object.keys(data.team_demand).length} teams
            &nbsp;·&nbsp; Generated from seeded simulation (seed {data.meta.seed})
          </p>
        </div>

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <KpiRow data={data} />

        {/* ── Insight callout ─────────────────────────────────────────────── */}
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderLeft: `4px solid ${C.amber}`,
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 28,
          fontSize: 14,
          lineHeight: 1.6,
          color: C.ink,
        }}>
          <span style={{ fontWeight: 600 }}>What the data shows: </span>
          The portfolio averages <b>{pct(portfolioAvgUtil)}</b> occupancy across all desks,
          but that average hides a distribution problem.{' '}
          <b style={{ color: C.red }}>{hotspot.zone}</b> peaks at{' '}
          <b style={{ color: C.red }}>{pct(hotspot.peak_util)}</b> on busy days — people
          can't find seats — while <b>{underusedCount} other neighborhoods</b> sit below
          40% average occupancy. <b>No new desks are needed.</b> The fix is moving the
          right teams to the right zones, which the planner below models interactively.
        </div>

        {/* ── Trend + DoW charts ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 28 }}>
          <TrendChart data={data.weekly_trend} ceiling={cap} />
          <DowChart   data={data.dow_profile} />
        </div>

        {/* ── Allocation planner ───────────────────────────────────────────── */}
        <div style={{
          background: '#fff',
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          borderTop: `3px solid ${C.blue}`,
          padding: '20px 22px',
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
              Seat Reallocation Planner
            </div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>
              Set a target occupancy ceiling. The planner identifies which teams to
              move, where to move them, and whether any neighborhoods become
              candidates for consolidation — all without adding desks.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>
              Occupancy ceiling:&nbsp;
              <span style={{ color: C.blue, fontWeight: 700, fontSize: 16 }}>{pct(cap)}</span>
            </div>
            <input
              type="range"
              min={0.60}
              max={0.95}
              step={0.05}
              value={cap}
              onChange={e => setCap(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 180, accentColor: C.blue }}
            />
            <button
              onClick={() => setShowAfter(s => !s)}
              style={{
                background: showAfter ? C.blue : '#fff',
                color: showAfter ? '#fff' : C.blue,
                border: `1.5px solid ${C.blue}`,
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showAfter ? 'Showing: After reallocation' : 'Show proposed plan'}
            </button>
          </div>
        </div>

        {/* ── Neighborhood before/after chart ─────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <NeighborhoodChart zones={result.after} showAfter={showAfter} ceiling={cap} />
        </div>

        {/* ── Moves + outcome ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 28 }}>
          <MovesPanel  moves={result.moves} ceiling={cap} />
          <OutcomePanel after={result.after} ceiling={cap} moves={result.moves} />
        </div>

        {/* ── Method footer ────────────────────────────────────────────────── */}
        <div style={{
          fontSize: 11.5,
          color: C.sub,
          lineHeight: 1.7,
          borderTop: `1px solid ${C.line}`,
          paddingTop: 16,
        }}>
          <b style={{ color: C.ink }}>How occupancy is measured.</b>{' '}
          Daily presence is simulated for each team using a Binomial model:
          headcount × (in-office days/week ÷ 5) × day-of-week multiplier
          (Mon 0.85× … Wed 1.23× … Fri 0.70×), over {data.meta.weeks} weeks.
          The planning metric is the <b>95th-percentile concurrent presence</b> ("peak seats"),
          not the average — planning to the average leaves people without desks on busy days.
          The reallocation engine moves the smallest teams first, preferring same-floor
          destinations to minimise disruption.{' '}
          <b>All data is synthetic</b> — see <code>scripts/generate-data.ts</code>.
        </div>

      </div>
    </div>
  );
}
