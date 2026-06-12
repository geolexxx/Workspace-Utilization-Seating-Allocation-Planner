import React from 'react';
import { C } from '../lib/theme';

interface PanelProps {
  title: string;
  note?: string;
  children: React.ReactNode;
}

export function Panel({ title, note, children }: PanelProps) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      padding: '16px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</div>
      {note && (
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 10, marginTop: 2 }}>{note}</div>
      )}
      {children}
    </div>
  );
}
