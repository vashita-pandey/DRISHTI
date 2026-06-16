/**
 * parisLaw.js
 * -----------
 * Crack growth projection engine for DRISHTI.
 *
 * Model: Paris' Law  →  da/dN = C · ΔK^m
 *
 * where ΔK = ΔS · √(π · a) · F
 *   a  = crack half-length (metres)
 *   ΔS = cyclic stress range (MPa) — default 80 MPa for B737 wing inspection scenario
 *   F  = geometry correction factor — default 1.12 (edge crack in plate)
 *
 * Material: Boeing 737 aluminium alloy 2024-T3
 *   C = 1.35e-10  (SI: m/cycle when ΔK in MPa·√m)
 *   m = 3.0
 *
 * Input records must match the DRISHTI inspection schema:
 *   { inspectionDate: ISO string, estimatedLengthMM: number, toleranceLimitMM: number }
 *
 * Grouped by: tailNumber + defectType + zone  (caller's responsibility)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARIS_C = 1.35e-10;   // Paris coefficient  (m/cycle, MPa√m units)
const PARIS_M = 3.0;        // Paris exponent
const DELTA_S = 80;         // Cyclic stress range (MPa) — B737 wing cruise assumption
const F       = 1.12;       // Geometry correction (edge crack in plate)
const CYCLES_PER_FLIGHT_HOUR = 1.0;   // 1 flight cycle ≈ 1 pressurisation cycle
const HOURS_PER_CYCLE        = 1.5;   // Average B737 block time (hours/cycle)

// ---------------------------------------------------------------------------
// Core: single integration step
// da/dN = C · (ΔS · √(π · a) · F) ^ m
// ---------------------------------------------------------------------------

/**
 * Integrates Paris' Law from a_start_mm until crack reaches limit_mm.
 *
 * @param {number} a_start_mm   - Starting crack length (mm)
 * @param {number} limit_mm     - Tolerance limit (mm); breach when a >= limit
 * @param {number} [maxCycles]  - Safety cap to prevent infinite loops (default 1e6)
 * @returns {{ cyclesRemaining: number, hoursRemaining: number } | null}
 *   null if already at or past tolerance
 */
function integrateToBreach(a_start_mm, limit_mm, maxCycles = 1_000_000) {
  if (a_start_mm == null || limit_mm == null) return null;
  if (a_start_mm >= limit_mm) return { cyclesRemaining: 0, hoursRemaining: 0 };

  let a = a_start_mm / 1000; // mm → m
  const a_limit = limit_mm / 1000;
  let cycles = 0;

  while (a < a_limit && cycles < maxCycles) {
    const deltaK = DELTA_S * Math.sqrt(Math.PI * a) * F; // MPa·√m
    const da = PARIS_C * Math.pow(deltaK, PARIS_M);       // m/cycle
    a += da;
    cycles++;
  }

  if (cycles >= maxCycles) return null; // did not converge

  return {
    cyclesRemaining: cycles,
    hoursRemaining:  Math.round(cycles * HOURS_PER_CYCLE),
  };
}

// ---------------------------------------------------------------------------
// Curve builder: returns (cycles, crack_mm) pairs for chart rendering
// ---------------------------------------------------------------------------

/**
 * Builds a projection curve from a_start_mm until breach or maxCycles.
 * Returns an array of { cycle, crackMM } points, sampled every `sampleEvery` cycles.
 *
 * @param {number} a_start_mm
 * @param {number} limit_mm
 * @param {number} [sampleEvery=50]
 * @param {number} [maxCycles=1e6]
 * @returns {Array<{ cycle: number, crackMM: number }>}
 */
function buildProjectionCurve(a_start_mm, limit_mm, sampleEvery = 50, maxCycles = 1_000_000) {
  if (a_start_mm == null || limit_mm == null) return [];

  let a = a_start_mm / 1000;
  const a_limit = limit_mm / 1000;
  let cycles = 0;
  const points = [{ cycle: 0, crackMM: a_start_mm }];

  while (a < a_limit && cycles < maxCycles) {
    const deltaK = DELTA_S * Math.sqrt(Math.PI * a) * F;
    const da = PARIS_C * Math.pow(deltaK, PARIS_M);
    a += da;
    cycles++;
    if (cycles % sampleEvery === 0 || a >= a_limit) {
      points.push({ cycle: cycles, crackMM: parseFloat((a * 1000).toFixed(4)) });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Main public function
// ---------------------------------------------------------------------------

/**
 * projectCrackGrowth
 * ------------------
 * Takes an array of DRISHTI inspection records for ONE crack group
 * (already filtered to a single tailNumber + defectType + zone),
 * fits them chronologically, and projects forward to tolerance breach.
 *
 * Records with null/zero estimatedLengthMM are silently skipped.
 *
 * @param {Array<{
 *   inspectionDate: string,
 *   estimatedLengthMM: number,
 *   toleranceLimitMM: number
 * }>} records
 *
 * @returns {{
 *   cyclesRemaining:      number | null,
 *   hoursRemaining:       number | null,
 *   projectedBreachDate:  Date   | null,
 *   projectionCurve:      Array<{ cycle: number, crackMM: number }>,
 *   latestCrackMM:        number | null,
 *   toleranceLimitMM:     number | null,
 *   verdictText:          string,
 *   error:                string | null
 * }}
 */
function projectCrackGrowth(records) {
  // --- Guard: need at least one valid record ---
  if (!records || records.length === 0) {
    return _errorResult('No records provided.');
  }

  // --- Filter invalid records ---
  // Schema confirmed (Day 1):
  //   estimatedLengthMM is always populated for cracks; null means the calculation
  //   genuinely failed — never 0. We filter null and guard against 0 defensively.
  //   toleranceLimitMM is always present on every record after DGCA lookup.
  const valid = records
    .filter(r => r.estimatedLengthMM != null && r.estimatedLengthMM > 0 && r.inspectionDate)
    .sort((a, b) => new Date(a.inspectionDate) - new Date(b.inspectionDate));

  if (valid.length === 0) {
    return _errorResult('No records with valid estimatedLengthMM found.');
  }

  // --- Pull latest values ---
  const latest       = valid[valid.length - 1];
  const latestCrackMM    = latest.estimatedLengthMM;
  const toleranceLimitMM = latest.toleranceLimitMM;
  const latestDate       = new Date(latest.inspectionDate);

  if (toleranceLimitMM == null) {
    return _errorResult('toleranceLimitMM missing on latest record.');
  }

  // --- Already breached ---
  if (latestCrackMM >= toleranceLimitMM) {
    return {
      cyclesRemaining:     0,
      hoursRemaining:      0,
      projectedBreachDate: latestDate,
      projectionCurve:     [],
      latestCrackMM,
      toleranceLimitMM,
      verdictText: `⚠️ Crack already at or beyond tolerance (${latestCrackMM}mm ≥ ${toleranceLimitMM}mm). Aircraft must be grounded.`,
      error: null,
    };
  }

  // --- Integrate forward ---
  const result = integrateToBreach(latestCrackMM, toleranceLimitMM);

  if (!result) {
    return _errorResult('Integration did not converge. Check input values.');
  }

  const { cyclesRemaining, hoursRemaining } = result;

  // --- Projected breach date ---
  const msPerHour = 3_600_000;
  const projectedBreachDate = new Date(latestDate.getTime() + hoursRemaining * msPerHour);

  // --- Build curve for chart ---
  const projectionCurve = buildProjectionCurve(latestCrackMM, toleranceLimitMM);

  // --- Verdict text ---
  const breachStr = projectedBreachDate.toISOString().slice(0, 10);
  const verdictText = cyclesRemaining === 0
    ? `⚠️ Crack has already breached tolerance.`
    : `Crack will exceed ${toleranceLimitMM}mm tolerance in ~${cyclesRemaining.toLocaleString()} cycles `
    + `(~${hoursRemaining.toLocaleString()} flight hours). `
    + `Projected breach: ${breachStr}.`;

  return {
    cyclesRemaining,
    hoursRemaining,
    projectedBreachDate,
    projectionCurve,
    latestCrackMM,
    toleranceLimitMM,
    verdictText,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function _errorResult(msg) {
  return {
    cyclesRemaining:     null,
    hoursRemaining:      null,
    projectedBreachDate: null,
    projectionCurve:     [],
    latestCrackMM:       null,
    toleranceLimitMM:    null,
    verdictText:         `Error: ${msg}`,
    error:               msg,
  };
}

// ---------------------------------------------------------------------------
// Exports (ESM — matches the React/Vite stack B is likely using)
// ---------------------------------------------------------------------------

export { projectCrackGrowth, integrateToBreach, buildProjectionCurve };
export default projectCrackGrowth;
