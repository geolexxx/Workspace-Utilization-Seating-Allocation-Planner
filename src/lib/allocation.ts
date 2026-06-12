import type { WorkspaceData, AllocationResult, Move, ZoneOutcome } from '../types';

// ── Cohesion scoring ──────────────────────────────────────────────────────────
// Physical floor ordering (labels are non-contiguous: L2, L3, L5, L6).
const FLOOR_ORDER: Record<string, number> = { L2: 0, L3: 1, L5: 2, L6: 3 };

function floorDist(f1: string, f2: string): number {
  return Math.abs((FLOOR_ORDER[f1] ?? 99) - (FLOOR_ORDER[f2] ?? 99));
}

/**
 * Floor-distance penalty expressed in "seat-equivalents" so it is directly
 * commensurable with spare capacity in the destination score.
 *
 * Same floor → 0   (no penalty: cohesion preserved)
 * ±1 floor   → 15  (mild: team is adjacent, still walkable)
 * ±2+ floors → 30  (strong: cross-building relocation)
 *
 * At 85% ceiling, L3-B (same floor as L3-A) has ~28 spare seats.
 * A zone on L6 with 30 spare seats scores 30-30=0 vs. L3-B's 28-0=28,
 * so L3-B is strongly preferred when it can absorb the demand.
 */
function floorPenalty(dist: number): number {
  if (dist === 0) return 0;
  if (dist === 1) return 15;
  return 30;
}

/**
 * Greedy seating allocation engine with team-cohesion soft constraint.
 *
 * Algorithm:
 *   1. Identify zones where peak demand exceeds (desks × targetCap).
 *   2. For each overcrowded zone, move the smallest teams first (least disruptive).
 *   3. Per team: prefer a SINGLE destination on the same/adjacent floor
 *      (scored = spare_capacity − floor_penalty). This keeps teams together
 *      and minimises cross-floor disruption.
 *   4. Only split a team across multiple zones when no single zone fits it.
 *      Split placements are also floor-scored.
 *   5. Returns the move list and per-zone before/after utilisation.
 *
 * Complexity: O(zones² × teams) — fast enough for any realistic portfolio size.
 * Every number it produces is traceable to a desk count and a ceiling; there is
 * no black-box optimiser. Suitable for explaining in an interview.
 */
export function runAllocation(data: WorkspaceData, targetCap: number): AllocationResult {
  // Build mutable zone state (integers throughout to avoid floating-point drift).
  const zones = data.neighborhoods.map(n => ({
    id:              n.id,
    zone:            n.zone,
    floor:           n.floor,
    desks:           n.desks,
    initialPeakUtil: n.peak_util,
    peakSeats:       Math.round(n.peak_util * n.desks),
    cap:             Math.floor(n.desks * targetCap),
  }));

  // Mutable team list — home field updated as teams are relocated.
  const teams = Object.entries(data.team_demand).map(([name, t]) => ({ name, ...t }));

  const moves: Move[] = [];

  for (const zone of zones.filter(z => z.peakSeats > z.cap)) {
    let excess = zone.peakSeats - zone.cap;

    // Smallest peak_demand first — minimises the number of teams displaced.
    const movable = teams
      .filter(t => t.home === zone.id)
      .sort((a, b) => a.peak_demand - b.peak_demand);

    for (const team of movable) {
      if (excess <= 0) break;

      const placements: { to: string; toZone: string; seats: number }[] = [];
      let need = team.peak_demand;

      // ── Cohesion: try to fit the whole team in one destination ───────────
      const wholeZone = zones
        .filter(z => z.id !== zone.id && z.cap - z.peakSeats >= team.peak_demand)
        .map(z => ({
          z,
          score: (z.cap - z.peakSeats) - floorPenalty(floorDist(zone.floor, z.floor)),
        }))
        .sort((a, b) => b.score - a.score)[0];

      if (wholeZone) {
        wholeZone.z.peakSeats += team.peak_demand;
        placements.push({ to: wholeZone.z.id, toZone: wholeZone.z.zone, seats: team.peak_demand });
        need = 0;
      } else {
        // No single zone fits the team — split across zones, still floor-scored.
        while (need > 0) {
          const dest = zones
            .filter(z => z.id !== zone.id && z.cap - z.peakSeats > 0)
            .map(z => ({
              z,
              spare: z.cap - z.peakSeats,
              score: (z.cap - z.peakSeats) - floorPenalty(floorDist(zone.floor, z.floor)),
            }))
            .sort((a, b) => b.score - a.score)[0];

          if (!dest) break; // no capacity left anywhere — leave remainder in zone
          const take = Math.min(need, dest.spare);
          dest.z.peakSeats += take;
          need -= take;
          placements.push({ to: dest.z.id, toZone: dest.z.zone, seats: take });
        }
      }

      const placed = team.peak_demand - need;
      if (placed === 0) continue; // couldn't place any — leave team in zone

      zone.peakSeats -= placed;
      excess -= placed;
      team.home = placements.length === 1 ? placements[0].to : 'split';

      for (const p of placements) {
        moves.push({
          team:     team.name,
          seats:    p.seats,
          from:     zone.id,
          fromZone: zone.zone,
          to:       p.to,
          toZone:   p.toZone,
          split:    placements.length > 1,
        });
      }
    }
  }

  const after: ZoneOutcome[] = zones.map(z => ({
    id:               z.id,
    zone:             z.zone,
    floor:            z.floor,
    desks:            z.desks,
    beforeUtil:       z.initialPeakUtil,
    afterUtil:        z.peakSeats / z.desks,
    beforePeakSeats:  Math.round(z.initialPeakUtil * z.desks),
    afterPeakSeats:   z.peakSeats,
  }));

  return { moves, after, ceiling: targetCap };
}
