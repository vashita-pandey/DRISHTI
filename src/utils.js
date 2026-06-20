import { calculateSeverity } from './severity/severity.js'
import toleranceData from './data/tolerance_737.json'

export function scoreSeverity(x, y, w, h, imageWidth, imageHeight) {
  const detection = {
    bbox: { x, y, width: w, height: h }
  }
  const { estimatedLengthMM, severityScore } = calculateSeverity(detection, imageWidth, imageHeight)
  return {
    crack_length_mm: estimatedLengthMM,
    severity_score: severityScore
  }
}

export function getToleranceLimit(defectType, zoneId, aircraftType = 'B737') {
  try {
    const aircraft = toleranceData.aircraft[aircraftType]
    if (!aircraft) return null
    return aircraft.defect_tolerances[defectType]?.[zoneId] ?? null
  } catch {
    return null
  }
}

export function getVerdict(defectType, zoneId, crackLengthMm, aircraftType = 'B737') {
  const limit = getToleranceLimit(defectType, zoneId, aircraftType)
  if (limit === null) return 'PASS'
  return crackLengthMm >= limit ? 'GROUND' : 'PASS'
}