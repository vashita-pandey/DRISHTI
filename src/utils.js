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

export function getVerdict(defectType, zoneId, crackLengthMm) {
  try {
    const limit = toleranceData.defect_tolerances[defectType]?.[zoneId]
    if (limit === undefined) return 'PASS'
    return crackLengthMm >= limit ? 'FAIL' : 'PASS'
  } catch {
    return 'PASS'
  }
}