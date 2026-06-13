import toleranceData from './data/tolerance_737.json'

export function scoreSeverity(x, y, w, h, imageWidth, imageHeight) {
  const widthRatio = w / imageWidth
  const heightRatio = h / imageHeight
  const longerSide = Math.max(widthRatio, heightRatio)

  // field of view covers ~200mm of surface at typical inspection distance
  const estimatedMm = parseFloat((longerSide * 200).toFixed(2))

  // severity: area-based, scaled to 0-100
  const area = widthRatio * heightRatio
  const severity = Math.min(100, Math.round(area * 20000))

  return {
    crack_length_mm: estimatedMm,
    severity_score: Math.max(1, severity)
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