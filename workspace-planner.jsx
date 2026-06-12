import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic regional-office dataset (12 weeks of badge-swipe occupancy).
// Stands in for the real artifacts a Real Estate Planning & BP analyst handles:
// desk inventory, space utilization, team headcount + hybrid working models.
// ─────────────────────────────────────────────────────────────────────────────
const DATA = {
  meta: { total_desks: 434, total_headcount: 362, weeks: 12, nominal_ratio: 0.834 },
  neighborhoods: [
    { id: "L2-A", floor: "L2", zone: "North Open", desks: 64, avg_util: 0.484, peak_util: 0.659, assigned_hc: 79 },
    { id: "L2-B", floor: "L2", zone: "North Quiet", desks: 40, avg_util: 0.288, peak_util: 0.401, assigned_hc: 18 },
    { id: "L3-A", floor: "L3", zone: "Central Hub", desks: 88, avg_util: 0.817, peak_util: 1.045, assigned_hc: 102 },
    { id: "L3-B", floor: "L3", zone: "Central Pods", desks: 48, avg_util: 0.185, peak_util: 0.25, assigned_hc: 12 },
    { id: "L5-A", floor: "L5", zone: "South Open", desks: 72, avg_util: 0.52, peak_util: 0.681, assigned_hc: 73 },
    { id: "L5-B", floor: "L5", zone: "South Collab", desks: 36, avg_util: 0.328, peak_util: 0.474, assigned_hc: 22 },
    { id: "L6-A", floor: "L6", zone: "Annex Flex", desks: 56, avg_util: 0.331, peak_util: 0.464, assigned_hc: 40 },
    { id: "L6-B", floor: "L6", zone: "Annex Focus", desks: 30, avg_util: 0.382, peak_util: 0.5, assigned_hc: 16 },
  ],
  team_demand: {
    "Trust & Safety": { headcount: 58, peak_demand: 56, in_office_days: 4.0, home: "L3-A" },
    "Monetization Eng": { headcount: 44, peak_demand: 38, in_office_days: 3.5, home: "L3-A" },
    "Creator Growth": { headcount: 31, peak_demand: 20, in_office_days: 2.5, home: "L2-A" },
    "Data Platform": { headcount: 39, peak_demand: 29, in_office_days: 3.0, home: "L5-A" },
    "Product Design": { headcount: 22, peak_demand: 17, in_office_days: 3.0, home: "L5-B" },
    "Commercial / Sales": { headcount: 48, peak_demand: 24, in_office_days: 2.0, home: "L2-A" },
    "Legal & Policy": { headcount: 18, peak_demand: 16, in_office_days: 3.5, home: "L2-B" },
    "Recruiting / HR": { headcount: 16, peak_demand: 15, in_office_days: 4.0, home: "L6-B" },
    "Finance / BizOps": { headcount: 21, peak_demand: 17, in_office_days: 3.0, home: "L6-A" },
    "Infra / SRE": { headcount: 34, peak_demand: 23, in_office_days: 2.5, home: "L5-A" },
    "Marketing": { headcount: 19, peak_demand: 12, in_office_days: 2.0, home: "L6-A" },
    "PMO": { headcount: 12, peak_demand: 12, in_office_days: 4.0, home: "L3-B" },
  },
  weekly_trend: [
    { week: 1, util: 0.468 }, { week: 2, util: 0.478 }, { week: 3, util: 0.473 },
    { week: 4, util: 0.46 }, { week: 5, util: 0.463 }, { week: 6, util: 0.471 },
    { week: 7, util: 0.478 }, { week: 8, util: 0.46 }, { week: 9, util: 0.463 },
    { week: 10, util: 0.469 }, { week: 11, util: 0.452 }, { week: 12, util: 0.467 },
  ],
  dow_profile: [
    { dow: 0, util: 0.397 }, { dow: 1, util: 0.536 }, { dow: 2, util: 0.577 },
    { dow: 3, util: 0.498 }, { dow: 4, util: 0.326 },
  ],
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const C = {
  ink: "#16243b", paper: "#f3f0e7", line: "#c9c2ad", grid: "#dcd6c4",
  blue: "#2d5d8a", blueLt: "#5b89b3", amber: "#d98a2b", red: "#b8492f",
  green: "#4a7c59", sub: "#6a6453",
};
const pct = (x) => `${Math.round(x * 100)}%`;

// ── Allocation engine ────────────────────────────────────────────────────────
// Goal: relieve any overcrowded neighborhood (peak > targetCap) by moving the
// smallest mobile team(s) into the most under-utilized zones with room to spare.
// Respects each zone's desk capacity at the chosen target utilization ceiling.
function runAllocation(targetCap) {
  const nbs = DATA.neighborhoods.map((n) => ({
    ...n,
    // effective peak seats currently demanded in this zone
    peakSeats: Math.round(n.peak_util * n.desks),
    cap: Math.floor(n.desks * targetCap),
  }));
  const byId = Object.fromEntries(nbs.map((n) => [n.id, n]));
  const teams = Object.entries(DATA.team_demand).map(([name, t]) => ({ name, ...t }));

  const moves = [];
  // Identify overcrowded zones (peak demand above capacity ceiling)
  const overcrowded = nbs.filter((n) => n.peakSeats > n.cap);

  overcrowded.forEach((zone) => {
    // We only need to shed the EXCESS, not relocate whole teams blindly.
    // Pick teams to relocate (smallest first = least disruptive) until the
    // remaining excess is cleared. A relocated team may be split across the
    // zones with the most spare capacity, since no single zone may hold it.
    let excess = zone.peakSeats - zone.cap;
    const movable = teams
      .filter((t) => t.home === zone.id)
      .sort((a, b) => a.peak_demand - b.peak_demand);

    for (const team of movable) {
      if (excess <= 0) break;
      let need = team.peak_demand;
      const placements = [];

      // Greedily fill from zones with the most spare capacity, splitting if needed.
      while (need > 0) {
        const dest = nbs
          .filter((n) => n.id !== zone.id)
          .map((n) => ({ n, spare: n.cap - n.peakSeats }))
          .filter((x) => x.spare > 0)
          .sort((a, b) => b.spare - a.spare)[0];
        if (!dest) break; // no capacity left anywhere
        const take = Math.min(need, dest.spare);
        dest.n.peakSeats += take;
        need -= take;
        placements.push({ to: dest.n.id, toZone: dest.n.zone, seats: take });
      }

      const placed = team.peak_demand - need;
      if (placed === 0) continue; // couldn't place any — leave team put

      zone.peakSeats -= placed;
      excess -= placed;
      team.home = placements.length === 1 ? placements[0].to : "split";

      placements.forEach((p) => {
        moves.push({
          team: team.name, seats: p.seats,
          from: zone.id, fromZone: byId[zone.id].zone,
          to: p.to, toZone: p.toZone,
          split: placements.length > 1,
        });
      });
    }
  });

  const after = nbs.map((n) => ({
    id: n.id, zone: n.zone, desks: n.desks,
    beforePeak: byId[n.id] ? n.peak_util : n.peak_util,
    afterUtil: Math.min(n.peakSeats / n.desks, 1.5),
  }));
  return { moves, after, nbs };
}

function Stat({ label, value, sub, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: "14px 16px", background: "#fff",
      border: `1px solid ${C.line}`, borderRadius: 2 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase",
        color: C.sub, fontFamily: "ui-monospace, monospace" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: tone || C.ink,
        lineHeight: 1.1, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function utilColor(u) {
  if (u > 0.95) return C.red;
  if (u > 0.7) return C.amber;
  if (u < 0.4) return C.blueLt;
  return C.green;
}

export default function App() {
  const [cap, setCap] = useState(0.85);
  const [showAfter, setShowAfter] = useState(false);
  const result = useMemo(() => runAllocation(cap), [cap]);

  const recoverable = useMemo(() => {
    // desks freed in zones that drop below 40% after reallocation (consolidation candidates)
    const freed = result.after
      .filter((a) => a.afterUtil < 0.35)
      .reduce((s, a) => s + Math.round(a.desks * (0.4 - a.afterUtil)), 0);
    return freed;
  }, [result]);

  const nbChart = result.nbs.map((n) => ({
    id: n.id, zone: n.zone,
    before: n.peak_util,
    after: Math.min(n.peakSeats / n.desks, 1.5),
  }));

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: C.ink,
      background: C.paper,
      backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
      backgroundSize: "26px 26px", minHeight: "100%", padding: "28px 22px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ borderBottom: `2px solid ${C.ink}`, paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11,
            letterSpacing: 2, color: C.blue, textTransform: "uppercase" }}>
            Real Estate Planning &amp; BP · AMS Portfolio
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "6px 0 2px",
            letterSpacing: -0.5 }}>Workspace Utilization &amp; Seating Allocation</h1>
          <div style={{ fontSize: 13, color: C.sub }}>
            12-week badge-swipe occupancy across 4 floors · 8 neighborhoods · 12 teams
            <span style={{ marginLeft: 8, fontStyle: "italic" }}>(synthetic demo data)</span>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          <Stat label="Desk Inventory" value={DATA.meta.total_desks} sub="seats across portfolio" />
          <Stat label="Assigned Headcount" value={DATA.meta.total_headcount}
            sub={`${pct(DATA.meta.nominal_ratio)} nominal ratio`} />
          <Stat label="Avg Utilization" value="47%" sub="badge-verified, weekday mean" tone={C.amber} />
          <Stat label="Peak Hotspot" value="104%" sub="L3-A Central Hub, over capacity" tone={C.red} />
        </div>

        {/* Insight callout */}
        <div style={{ background: "#fff", border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${C.amber}`, borderRadius: 2, padding: "14px 16px",
          marginBottom: 24, fontSize: 13.5, lineHeight: 1.55 }}>
          <b>Headline finding.</b> The portfolio runs at 47% average utilization, yet
          Central Hub (L3-A) peaks at 104% — over capacity — while four neighborhoods
          sit below 40%. The problem isn't a desk shortage; it's <i>distribution</i>.
          Reallocation can relieve the hotspot and surface consolidation opportunity
          without adding a single seat.
        </div>

        {/* Two charts: trend + day-of-week */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 26 }}>
          <Panel title="Portfolio utilization — weekly trend"
            note="Flat at ~47%. Stable underuse, not a ramp.">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={DATA.weekly_trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="2 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.sub }}
                  tickFormatter={(w) => `W${w}`} />
                <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10, fill: C.sub }} />
                <Tooltip formatter={(v) => pct(v)} labelFormatter={(w) => `Week ${w}`}
                  contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <ReferenceLine y={0.85} stroke={C.red} strokeDasharray="4 3"
                  label={{ value: "target 85%", fontSize: 9, fill: C.red, position: "insideTopRight" }} />
                <Line type="monotone" dataKey="util" stroke={C.blue} strokeWidth={2.5}
                  dot={{ r: 2.5, fill: C.blue }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Day-of-week profile" note="Tue–Wed anchor; Fri collapses to 33%.">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={DATA.dow_profile} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="dow" tickFormatter={(d) => DOW[d]} tick={{ fontSize: 10, fill: C.sub }} />
                <YAxis domain={[0, 0.7]} tickFormatter={pct} tick={{ fontSize: 10, fill: C.sub }} />
                <Tooltip formatter={(v) => pct(v)} labelFormatter={(d) => DOW[d]}
                  contentStyle={{ fontSize: 12, borderRadius: 2 }} />
                <Bar dataKey="util" radius={[2, 2, 0, 0]}>
                  {DATA.dow_profile.map((d, i) => (
                    <Cell key={i} fill={d.util > 0.5 ? C.blue : C.blueLt} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* Allocation controls */}
        <div style={{ background: C.ink, color: "#fff", borderRadius: 2, padding: "18px 20px",
          marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
            flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: 2,
                color: C.amber, textTransform: "uppercase" }}>Allocation Engine</div>
              <div style={{ fontSize: 14, color: "#d9d3c2", marginTop: 3 }}>
                Reassign teams from over-capacity zones into the most under-used ones,
                respecting a desk-utilization ceiling.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#d9d3c2" }}>
              Target utilization ceiling:&nbsp;
              <b style={{ color: C.amber, fontSize: 15 }}>{pct(cap)}</b>
            </label>
            <input type="range" min={0.6} max={0.95} step={0.05} value={cap}
              onChange={(e) => setCap(parseFloat(e.target.value))}
              style={{ flex: 1, minWidth: 180, accentColor: C.amber }} />
            <button onClick={() => setShowAfter((s) => !s)}
              style={{ background: showAfter ? C.amber : "transparent", color: showAfter ? C.ink : "#fff",
                border: `1px solid ${C.amber}`, borderRadius: 2, padding: "7px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "ui-monospace, monospace" }}>
              {showAfter ? "Showing: AFTER" : "Show proposed plan"}
            </button>
          </div>
        </div>

        {/* Neighborhood before/after */}
        <Panel title={`Neighborhood peak utilization — ${showAfter ? "after reallocation" : "current state"}`}
          note="Red = over capacity · amber = tight · blue = under-used capacity to redeploy.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={nbChart} layout="vertical"
              margin={{ top: 4, right: 40, left: 70, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="2 3" horizontal={false} />
              <XAxis type="number" domain={[0, 1.2]} tickFormatter={pct}
                tick={{ fontSize: 10, fill: C.sub }} />
              <YAxis type="category" dataKey="zone" width={90}
                tick={{ fontSize: 10.5, fill: C.ink }} />
              <Tooltip formatter={(v) => pct(v)} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
              <ReferenceLine x={cap} stroke={C.ink} strokeDasharray="4 3"
                label={{ value: "ceiling", fontSize: 9, fill: C.ink, position: "top" }} />
              <ReferenceLine x={1} stroke={C.red} strokeWidth={1} />
              <Bar dataKey={showAfter ? "after" : "before"} radius={[0, 2, 2, 0]}>
                {nbChart.map((n, i) => (
                  <Cell key={i} fill={utilColor(showAfter ? n.after : n.before)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Moves + outcome */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 22 }}>
          <Panel title="Proposed moves" note={`${result.moves.length} reassignment(s) at ${pct(cap)} ceiling`}>
            {result.moves.length === 0 ? (
              <div style={{ fontSize: 13, color: C.sub, padding: "10px 0" }}>
                No moves required — every zone sits within the {pct(cap)} ceiling.
                Loosen the ceiling to see consolidation options.
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontFamily: "ui-monospace, monospace" }}>
                {result.moves.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 0", borderBottom: i < result.moves.length - 1 ? `1px solid ${C.grid}` : "none" }}>
                    <span style={{ fontWeight: 600, color: C.ink, flex: 1 }}>{m.team}</span>
                    <span style={{ color: C.sub }}>{m.seats} seats</span>
                    <span style={{ color: C.red }}>{m.from}</span>
                    <span style={{ color: C.sub }}>→</span>
                    <span style={{ color: C.green }}>{m.to}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Outcome" note="What the plan buys you">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <OutcomeRow label="Hotspot relieved"
                value={result.after.find((a) => a.id === "L3-A").afterUtil <= cap ? "Yes" : "Partial"}
                tone={C.green} />
              <OutcomeRow label="Teams moved" value={result.moves.length} tone={C.ink} />
              <OutcomeRow label="Recoverable desks"
                value={`~${recoverable}`} tone={C.blue}
                sub="in zones dropping below 35%" />
              <OutcomeRow label="New seats required" value="0" tone={C.green}
                sub="solved by redistribution" />
            </div>
          </Panel>
        </div>

        {/* Method footer */}
        <div style={{ marginTop: 24, fontSize: 11.5, color: C.sub, lineHeight: 1.6,
          borderTop: `1px solid ${C.line}`, paddingTop: 14, fontFamily: "ui-monospace, monospace" }}>
          <b style={{ color: C.ink }}>Method.</b> Occupancy simulated from team headcount ×
          hybrid working-model (in-office days/week) × midweek day-of-week curve, sampled over
          12 weeks. Effective demand = 95th-percentile concurrent presence (peak seats), so
          planning targets real peaks, not averages. Allocation greedily moves the least-disruptive
          teams out of over-ceiling zones into those with the most spare capacity, never exceeding
          each zone's desk count at the chosen ceiling.
        </div>
      </div>
    </div>
  );
}

function Panel({ title, note, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 2, padding: "14px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</div>
      {note && <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>{note}</div>}
      {children}
    </div>
  );
}

function OutcomeRow({ label, value, sub, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <div style={{ fontSize: 12.5, color: C.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.sub }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
