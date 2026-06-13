import Dexie from 'dexie'

export const db = new Dexie('DrishtiDB')

db.version(1).stores({
  inspections: '++id, tail_number, zone_id, defect_type, severity_score, crack_length_mm, verdict, timestamp, inspector_id'
})