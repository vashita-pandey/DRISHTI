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

export function getToleranceLimit(defectType, zoneId) {
  try {
    return toleranceData.defect_tolerances[defectType]?.[zoneId] ?? null
  } catch {
    return null
  }
}

export function getVerdict(defectType, zoneId, crackLengthMm) {
  const limit = getToleranceLimit(defectType, zoneId)
  if (limit === null) return 'PASS'
  return crackLengthMm >= limit ? 'GROUND' : 'PASS'
}