import { C } from '../lib/theme';

interface StatProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
  accent?: string;  // colored bar along the top edge
}

export function Stat({ label, value, sub, tone, accent }: StatProps) {
  return (
    <div style={{
      flex: 1,
      minWidth: 150,
      background: '#fff',
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      borderTop: accent ? `3px solid ${accent}` : `1px solid ${C.line}`,
      padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 500,
        color: C.sub,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        color: tone ?? C.ink,
        lineHeight: 1.15,
        marginTop: 6,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
