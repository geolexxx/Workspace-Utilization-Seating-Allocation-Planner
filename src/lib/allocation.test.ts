import { describe, it, expect } from 'vitest';
import { runAllocation } from './allocation';
import rawData from '../data/workspace.json';
import type { WorkspaceData } from '../types';

const data = rawData as WorkspaceData;

const CEILINGS = [0.60, 0.70, 0.80, 0.85, 0.90, 0.95] as const;

// ── Seat conservation ─────────────────────────────────────────────────────────
// Every move shifts seats between zones; none are created or destroyed.
// We use the integer afterPeakSeats field to avoid floating-point round-trip error.

describe('seat conservation', () => {
  it.each(CEILINGS)('total peak seats conserved at ceiling %f', cap => {
    const result = runAllocation(data, cap);
    const before = result.after.reduce((s, z) => s + z.beforePeakSeats, 0);
    const after  = result.after.reduce((s, z) => s + z.afterPeakSeats,  0);
    expect(after).toBe(before);
  });
});

// ── Ceiling enforcement ───────────────────────────────────────────────────────
// When the portfolio has enough total capacity, no zone should exceed the ceiling.

describe('ceiling enforcement', () => {
  it.each(CEILINGS)('no zone exceeds ceiling %f when system is feasible', cap => {
    const totalCap    = data.neighborhoods.reduce((s, n) => s + Math.floor(n.desks * cap), 0);
    const totalDemand = data.neighborhoods.reduce((s, n) => s + Math.round(n.peak_util * n.desks), 0);

    if (totalCap < totalDemand) return; // skip infeasible configurations

    const result = runAllocation(data, cap);
    result.after.forEach(z => {
      // Small float tolerance: afterUtil = integer / integer, should be exact,
      // but guard against any rounding at the boundary.
      expect(z.afterUtil).toBeLessThanOrEqual(cap + 1e-9);
    });
  });
});

// ── Hotspot relief ────────────────────────────────────────────────────────────

describe('hotspot relief', () => {
  it('L3-A (Central Hub) is relieved at 85% ceiling', () => {
    const result     = runAllocation(data, 0.85);
    const centralHub = result.after.find(z => z.id === 'L3-A');
    expect(centralHub).toBeDefined();
    expect(centralHub!.afterUtil).toBeLessThanOrEqual(0.85 + 1e-9);
  });

  it('L3-A afterUtil < beforeUtil at any ceiling below its initial peak', () => {
    const hub = data.neighborhoods.find(n => n.id === 'L3-A')!;
    // ceiling set 10% below its current peak → must be relieved
    const cap    = hub.peak_util * 0.9;
    const result = runAllocation(data, cap);
    const after  = result.after.find(z => z.id === 'L3-A')!;
    expect(after.afterUtil).toBeLessThan(after.beforeUtil);
  });
});

// ── Move validity ─────────────────────────────────────────────────────────────

describe('move validity', () => {
  it.each(CEILINGS)('all moves reference valid, distinct zone IDs at ceiling %f', cap => {
    const zoneIds = new Set(data.neighborhoods.map(n => n.id));
    const result  = runAllocation(data, cap);
    result.moves.forEach(m => {
      expect(zoneIds.has(m.from)).toBe(true);
      expect(zoneIds.has(m.to)).toBe(true);
      expect(m.from).not.toBe(m.to);
      expect(m.seats).toBeGreaterThan(0);
    });
  });

  it('tighter ceiling requires at least as many moves as a looser one', () => {
    const r60 = runAllocation(data, 0.60);
    const r95 = runAllocation(data, 0.95);
    expect(r95.moves.length).toBeLessThanOrEqual(r60.moves.length);
  });

  it('ceiling above every zone peak_util produces zero moves', () => {
    const maxPeak = Math.max(...data.neighborhoods.map(n => n.peak_util));
    // ceiling just above the worst hotspot → nothing needs to move
    const result  = runAllocation(data, maxPeak + 0.01);
    expect(result.moves).toHaveLength(0);
  });
});

// ── Cohesion soft constraint ──────────────────────────────────────────────────
// Verify the floor-penalty logic with a small synthetic dataset where the
// correct answer is unambiguous.

describe('cohesion soft constraint', () => {
  it('prefers same-floor destination over cross-floor when both can fit the team', () => {
    // Three zones:
    //   L2-A (overcrowded), L2-B (same floor, plenty of spare), L6-A (far floor, more spare)
    // At 80% ceiling the algorithm must choose between:
    //   L2-B: spare = 18, penalty = 0  → score = 18
    //   L6-A: spare = 22, penalty = 30 → score = -8   (rejected despite more raw spare)
    const testData: WorkspaceData = {
      meta: {
        total_desks: 110, total_headcount: 55, weeks: 12,
        nominal_ratio: 0.5, seed: 0, generated_at: '',
      },
      neighborhoods: [
        { id: 'L2-A', floor: 'L2', zone: 'Zone A', desks: 50, avg_util: 0.88, peak_util: 0.90, assigned_hc: 45 },
        { id: 'L2-B', floor: 'L2', zone: 'Zone B', desks: 30, avg_util: 0.20, peak_util: 0.20, assigned_hc:  5 },
        { id: 'L6-A', floor: 'L6', zone: 'Zone C', desks: 30, avg_util: 0.10, peak_util: 0.10, assigned_hc:  5 },
      ],
      team_demand: {
        // peak_demand = 8; fits in either L2-B (spare=18) or L6-A (spare=22)
        BigTeam: { headcount: 40, peak_demand: 8, in_office_days: 1.0, home: 'L2-A' },
      },
      weekly_trend: [],
      dow_profile:  [],
    };
    // L2-A: peakSeats = round(0.90 × 50) = 45, cap = floor(50 × 0.80) = 40, excess = 5
    // L2-B: spare = floor(30 × 0.80) − round(0.20 × 30) = 24 − 6 = 18  (≥ 8 → whole-team fit)
    // L6-A: spare = floor(30 × 0.80) − round(0.10 × 30) = 24 − 3 = 21  (≥ 8 → whole-team fit)
    // Cohesion scores: L2-B = 18 − 0 = 18, L6-A = 21 − 30 = −9
    // Expected: team goes to L2-B
    const result = runAllocation(testData, 0.80);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].to).toBe('L2-B');
  });

  it('falls back to cross-floor when same-floor has no capacity', () => {
    // Same layout but L2-B is also nearly full — no spare for same-floor placement.
    const testData: WorkspaceData = {
      meta: {
        total_desks: 110, total_headcount: 80, weeks: 12,
        nominal_ratio: 0.73, seed: 0, generated_at: '',
      },
      neighborhoods: [
        { id: 'L2-A', floor: 'L2', zone: 'Zone A', desks: 50, avg_util: 0.88, peak_util: 0.90, assigned_hc: 45 },
        { id: 'L2-B', floor: 'L2', zone: 'Zone B', desks: 30, avg_util: 0.90, peak_util: 0.95, assigned_hc: 29 },
        { id: 'L6-A', floor: 'L6', zone: 'Zone C', desks: 30, avg_util: 0.10, peak_util: 0.10, assigned_hc:  5 },
      ],
      team_demand: {
        BigTeam: { headcount: 40, peak_demand: 8, in_office_days: 1.0, home: 'L2-A' },
      },
      weekly_trend: [],
      dow_profile:  [],
    };
    // L2-B: spare = floor(30 × 0.80) − round(0.95 × 30) = 24 − 29 = −5  (no capacity)
    // L6-A: spare = 24 − 3 = 21 (has capacity) → only option
    const result = runAllocation(testData, 0.80);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0].to).toBe('L6-A');
  });
});
