import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { C, pct } from '../lib/theme';
import { Panel } from './Panel';
import type { DowPoint } from '../types';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface DowChartProps {
  data: DowPoint[];
}

export function DowChart({ data }: DowChartProps) {
  return (
    <Panel
      title="Day-of-week profile"
      note="Tue–Wed anchor; Fri collapses to ~33%."
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 3" vertical={false} />
          <XAxis
            dataKey="dow"
            tickFormatter={(d: number) => DOW[d]}
            tick={{ fontSize: 10, fill: C.sub }}
          />
          <YAxis
            domain={[0, 0.7]}
            tickFormatter={pct}
            tick={{ fontSize: 10, fill: C.sub }}
          />
          <Tooltip
            formatter={(v: number) => pct(v)}
            labelFormatter={(d: number) => DOW[d]}
            contentStyle={{ fontSize: 12, borderRadius: 2 }}
          />
          <Bar dataKey="util" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.util > 0.5 ? C.blue : C.blueLt} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}
