// ─────────────────────────────────────────────────────────────────────────────
// Domain types for the workspace utilization & seating allocation planner.
// Consumed by both the data generator (scripts/) and the React app (src/).
// ─────────────────────────────────────────────────────────────────────────────

export interface Meta {
  total_desks: number;
  total_headcount: number;
  weeks: number;
  nominal_ratio: number;
  seed: number;
  generated_at: string;
}

export interface Neighborhood {
  id: string;
  floor: string;
  zone: string;
  desks: number;
  avg_util: number;   // mean daily occupancy / desks
  peak_util: number;  // 95th-percentile daily occupancy / desks
  assigned_hc: number;
}

export interface TeamDemand {
  headcount: number;
  peak_demand: number;  // 95th-percentile concurrent presence (peak seats)
  in_office_days: number;
  home: string;         // neighborhood id
}

export interface WeekPoint {
  week: number;
  util: number;
}

export interface DowPoint {
  dow: number;   // 0 = Mon … 4 = Fri
  util: number;
}

export interface WorkspaceData {
  meta: Meta;
  neighborhoods: Neighborhood[];
  team_demand: Record<string, TeamDemand>;
  weekly_trend: WeekPoint[];
  dow_profile: DowPoint[];
}

// ── Allocation result ────────────────────────────────────────────────────────

export interface Move {
  team: string;
  seats: number;
  from: string;
  fromZone: string;
  to: string;
  toZone: string;
  split: boolean;  // true when the team was spread across more than one destination
}

export interface ZoneOutcome {
  id: string;
  zone: string;
  floor: string;
  desks: number;
  beforeUtil: number;
  afterUtil: number;
  beforePeakSeats: number;  // integer — for exact conservation assertions in tests
  afterPeakSeats: number;   // integer
}

export interface AllocationResult {
  moves: Move[];
  after: ZoneOutcome[];
  ceiling: number;
}
