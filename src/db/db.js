import Dexie from 'dexie'

export const db = new Dexie('DrishtiDB')

db.version(2).stores({
  inspections: '++id, tailNumber, aircraftType, inspectionDate, inspectorId, zone, zoneId, defectType, confidence, estimatedLengthMM, severityScore, toleranceLimitMM, verdict, syncStatus, createdAt'
})