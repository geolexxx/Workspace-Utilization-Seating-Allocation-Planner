import { C } from '../lib/theme';
import { Panel } from './Panel';
import type { ZoneOutcome, Move } from '../types';

interface OutcomePanelProps {
  after: ZoneOutcome[];
  ceiling: number;
  moves: Move[];
}

interface OutcomeRowProps {
  label: string;
  value: string | number;
  sub?: string;
  tone: string;
}

function OutcomeRow({ label, value, sub, tone }: OutcomeRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div>
        <div style={{ fontSize: 12.5, color: C.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.sub }}>{sub}</div>}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: tone,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  );
}

export function OutcomePanel({ after, ceiling, moves }: OutcomePanelProps) {
  // Count teams actually moved (deduplicated by team name — splits count as one).
  const teamsMoved = new Set(moves.map(m => m.team)).size;

  // Hotspot = zone with highest beforeUtil; check if it's now within ceiling.
  const hotspot = after.reduce((max, z) => (z.beforeUtil > max.beforeUtil ? z : max), after[0]);
  const hotspotRelieved = hotspot.afterUtil <= ceiling + 1e-9;

  // Desks recoverable in zones that drop below 35% utilization after reallocation
  // (consolidation candidates — could be closed or repurposed).
  const recoverableDesks = after
    .filter(z => z.afterUtil < 0.35)
    .reduce((s, z) => s + Math.round(z.desks * (0.35 - z.afterUtil)), 0);

  return (
    <Panel title="Outcome" note="What the plan buys you">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <OutcomeRow
          label="Hotspot relieved"
          value={hotspotRelieved ? 'Yes' : 'Partial'}
          tone={hotspotRelieved ? C.green : C.amber}
        />
        <OutcomeRow
          label="Teams relocated"
          value={teamsMoved}
          tone={C.ink}
        />
        <OutcomeRow
          label="Recoverable desks"
          value={`~${recoverableDesks}`}
          sub="in zones dropping below 35%"
          tone={C.blue}
        />
        <OutcomeRow
          label="New seats required"
          value="0"
          sub="solved by redistribution"
          tone={C.green}
        />
      </div>
    </Panel>
  );
}
