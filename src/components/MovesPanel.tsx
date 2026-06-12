import { C, pct } from '../lib/theme';
import { Panel } from './Panel';
import type { Move } from '../types';

interface MovesPanelProps {
  moves: Move[];
  ceiling: number;
}

export function MovesPanel({ moves, ceiling }: MovesPanelProps) {
  return (
    <Panel
      title="Proposed moves"
      note={`${moves.length} reassignment(s) at ${pct(ceiling)} ceiling`}
    >
      {moves.length === 0 ? (
        <div style={{ fontSize: 13, color: C.sub, padding: '10px 0' }}>
          No moves required — every zone sits within the {pct(ceiling)} ceiling.
          Tighten the ceiling to surface consolidation options.
        </div>
      ) : (
        <div style={{ fontSize: 12.5, fontFamily: 'ui-monospace, monospace' }}>
          {moves.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 0',
                borderBottom: i < moves.length - 1 ? `1px solid ${C.grid}` : 'none',
              }}
            >
              <span style={{ fontWeight: 600, color: C.ink, flex: 1 }}>
                {m.team}
                {m.split && (
                  <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}> (split)</span>
                )}
              </span>
              <span style={{ color: C.sub }}>{m.seats} seats</span>
              <span style={{ color: C.red }}>{m.from}</span>
              <span style={{ color: C.sub }}>→</span>
              <span style={{ color: C.green }}>{m.to}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
