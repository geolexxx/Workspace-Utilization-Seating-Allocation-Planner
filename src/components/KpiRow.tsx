import { Stat } from './Stat';
import { C, pct } from '../lib/theme';
import type { WorkspaceData } from '../types';

interface KpiRowProps {
  data: WorkspaceData;
}

export function KpiRow({ data }: KpiRowProps) {
  const avgUtil = data.weekly_trend.reduce((s, w) => s + w.util, 0) / data.weekly_trend.length;

  const hotspot = data.neighborhoods.reduce(
    (max, n) => (n.peak_util > max.peak_util ? n : max),
    data.neighborhoods[0]
  );

  const underusedCount = data.neighborhoods.filter(n => n.avg_util < 0.40).length;

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      <Stat
        label="Total Desks"
        value={data.meta.total_desks}
        sub={`${data.neighborhoods.length} neighborhoods across 4 floors`}
        accent={C.blue}
      />
      <Stat
        label="Assigned Headcount"
        value={data.meta.total_headcount}
        sub={`${pct(data.meta.nominal_ratio)} desk-to-headcount ratio`}
        accent={C.blue}
      />
      <Stat
        label="Avg Occupancy"
        value={pct(avgUtil)}
        sub="Mean daily occupancy, weekdays only"
        tone={C.amber}
        accent={C.amber}
      />
      <Stat
        label="Underused Zones"
        value={underusedCount}
        sub="Neighborhoods below 40% avg occupancy"
        tone={C.sub}
        accent={C.sub}
      />
      <Stat
        label="Over-Capacity Zone"
        value={pct(hotspot.peak_util)}
        sub={`${hotspot.zone} (${hotspot.id}) on peak days`}
        tone={C.red}
        accent={C.red}
      />
    </div>
  );
}
