export const C = {
  ink:    '#111827',
  paper:  '#F3F4F6',
  line:   '#E5E7EB',
  grid:   '#F3F4F6',
  blue:   '#1D4ED8',
  blueLt: '#BFDBFE',
  amber:  '#D97706',
  red:    '#DC2626',
  green:  '#15803D',
  sub:    '#6B7280',
} as const;

export function utilColor(u: number): string {
  if (u > 0.95) return C.red;
  if (u > 0.7)  return C.amber;
  if (u < 0.4)  return C.blueLt;
  return C.green;
}

export const pct = (x: number): string => `${Math.round(x * 100)}%`;
