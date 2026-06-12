import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { C, pct, utilColor } from '../lib/theme';
import { Panel } from './Panel';
import type { ZoneOutcome } from '../types';

interface NeighborhoodChartProps {
  zones: ZoneOutcome[];
  showAfter: boolean;
  ceiling: number;
}

export function NeighborhoodChart({ zones, showAfter, ceiling }: NeighborhoodChartProps) {
  // Cap display at 150% to keep axis readable; label the actual value.
  const chartData = zones.map(z => ({
    zone:   z.zone,
    before: Math.min(z.beforeUtil, 1.5),
    after:  Math.min(z.afterUtil,  1.5),
  }));

  const activeKey = showAfter ? 'after' : 'before';

  return (
    <Panel
      title={`Neighborhood peak utilization — ${showAfter ? 'after reallocation' : 'current state'}`}
      note="Red = over capacity · amber = tight · blue = under-used capacity to redeploy."
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 70, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1.2]}
            tickFormatter={pct}
            tick={{ fontSize: 10, fill: C.sub }}
          />
          <YAxis
            type="category"
            dataKey="zone"
            width={90}
            tick={{ fontSize: 10.5, fill: C.ink }}
          />
          <Tooltip
            formatter={(v: number) => pct(v)}
            contentStyle={{ fontSize: 12, borderRadius: 2 }}
          />
          <ReferenceLine
            x={ceiling}
            stroke={C.ink}
            strokeDasharray="4 3"
            label={{ value: 'ceiling', fontSize: 9, fill: C.ink, position: 'top' }}
          />
          <ReferenceLine x={1} stroke={C.red} strokeWidth={1} />
          <Bar dataKey={activeKey} radius={[0, 2, 2, 0]}>
            {zones.map((z, i) => (
              <Cell
                key={i}
                fill={utilColor(showAfter ? z.afterUtil : z.beforeUtil)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}
