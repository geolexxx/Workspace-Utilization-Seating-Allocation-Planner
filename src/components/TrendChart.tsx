import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { C, pct } from '../lib/theme';
import { Panel } from './Panel';
import type { WeekPoint } from '../types';

interface TrendChartProps {
  data: WeekPoint[];
  ceiling: number;
}

export function TrendChart({ data, ceiling }: TrendChartProps) {
  return (
    <Panel
      title="Portfolio utilization — weekly trend"
      note="Flat signal across 12 weeks: stable underuse, not a ramp."
    >
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 3" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: C.sub }}
            tickFormatter={(w: number) => `W${w}`}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={pct}
            tick={{ fontSize: 10, fill: C.sub }}
          />
          <Tooltip
            formatter={(v: number) => pct(v)}
            labelFormatter={(w: number) => `Week ${w}`}
            contentStyle={{ fontSize: 12, borderRadius: 2 }}
          />
          <ReferenceLine
            y={ceiling}
            stroke={C.red}
            strokeDasharray="4 3"
            label={{ value: `target ${pct(ceiling)}`, fontSize: 9, fill: C.red, position: 'insideTopRight' }}
          />
          <Line
            type="monotone"
            dataKey="util"
            stroke={C.blue}
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: C.blue }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}
