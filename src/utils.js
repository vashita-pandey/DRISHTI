import toleranceData from './data/tolerance_737.json'

export function scoreSeverity(x, y, w, h, imageWidth, imageHeight) {
  const widthRatio = w / imageWidth
  const heightRatio = h / imageHeight
  const longerSide = Math.max(widthRatio, heightRatio)
  const estimatedMm = longerSide * 200
  const area = widthRatio * heightRatio
  const severity = Math.min(100, Math.round(area * 2000))

  return {
    crack_length_mm: parseFloat(estimatedMm.toFixed(2)),
    severity_score: severity
  }
}

export function getVerdict(defectType, zoneId, crackLengthMm) {
  try {
    const limit = toleranceData.defect_tolerances[defectType]?.[zoneId]
    console.log(`Zone: ${zoneId} | Defect: ${defectType} | Length: ${crackLengthMm}mm | Limit: ${limit}mm`)
    if (limit === undefined) return 'PASS'
    return crackLengthMm >= limit ? 'FAIL' : 'PASS'
  } catch {
    return 'PASS'
  }
}