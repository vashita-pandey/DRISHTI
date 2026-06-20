import { useEffect, useState } from 'react'
import { db } from '../db/db'
import EmersonNI from './EmersonNI'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'

const ALL_TAILS = ['VT-TEST-001', 'VT-TEST-002', 'VT-TEST-003']

const DEFECT_COLORS = {
  crack: '#00c2ff',
  corrosion: '#f59e0b',
  dent: '#a78bfa',
  paint_blister: '#34d399',
  delamination: '#f87171'
}

export default function HistoryGraph() {
  const [records, setRecords] = useState([])
  const [selectedTail, setSelectedTail] = useState('VT-TEST-001')
  const [chartData, setChartData] = useState([])
  const [projection, setProjection] = useState(null)
  const TOLERANCE_LIMIT = 4.0

  const C = 1.35e-10
  const M = 3.0

  function exportReport() {
    const tailRecordsToExport = records.filter(r => r.tailNumber === selectedTail)
    const report = {
      exported_at: new Date().toISOString(),
      aircraft: selectedTail,
      aircraft_type: 'B737',
      total_inspections: tailRecordsToExport.length,
      ground_count: tailRecordsToExport.filter(r => r.verdict === 'GROUND').length,
      pass_count: tailRecordsToExport.filter(r => r.verdict === 'PASS').length,
      inspectors: [...new Set(tailRecordsToExport.map(r => r.inspectorId))],
      records: tailRecordsToExport
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DRISHTI_${selectedTail}_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function parisLawProject(inspections) {
    if (inspections.length < 2) return null
    const crackOnly = inspections.filter(r => r.defectType === 'crack')
    if (crackOnly.length < 2) return null

    const last = crackOnly[crackOnly.length - 1]
    let a = last.estimatedLengthMM || 0
    let cycles = 0
    const maxCycles = 1e7
    const stepSize = 1000

    while (a < TOLERANCE_LIMIT && cycles < maxCycles) {
      const deltaK = 1.12 * 50 * Math.sqrt(Math.PI * a / 1000)
      const dadN = C * Math.pow(deltaK, M)
      a += dadN * stepSize
      cycles += stepSize
    }

    const hoursRemaining = Math.round(cycles / 3600)
    const inspectionsRemaining = Math.max(0, Math.floor(hoursRemaining / 500))
    return { hoursRemaining, inspectionsRemaining, willBreach: a >= TOLERANCE_LIMIT }
  }

  useEffect(() => {
    async function loadRecords() {
      const all = await db.inspections.toArray()
      setRecords(all)
    }
    loadRecords()
    const interval = setInterval(loadRecords, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const filtered = records
      .filter(r => r.tailNumber === selectedTail)
      .sort((a, b) => new Date(a.inspectionDate) - new Date(b.inspectionDate))
      .map((r, i) => ({
        inspection: `#${i + 1}`,
        estimatedLengthMM: r.estimatedLengthMM,
        defectType: r.defectType,
        severityScore: r.severityScore,
        verdict: r.verdict,
        timestamp: new Date(r.inspectionDate).toLocaleTimeString()
      }))

    setChartData(filtered)

    const crackRecords = filtered.filter(r => r.defectType === 'crack')
    if (crackRecords.length >= 2) {
      setProjection(parisLawProject(filtered))
    } else {
      setProjection(null)
    }
  }, [records, selectedTail])

  const zoneData = (() => {
    const counts = {}
    records
      .filter(r => r.tailNumber === selectedTail)
      .forEach(r => {
        const z = r.zone || 'unknown'
        counts[z] = (counts[z] || 0) + 1
      })
    return counts
  })()

  const maxCount = Math.max(...Object.values(zoneData), 1)

  function zoneColor(zoneId) {
    const count = zoneData[zoneId] || 0
    const ratio = count / maxCount
    if (ratio === 0) return '#1e2d40'
    if (ratio < 0.33) return '#854d0e'
    if (ratio < 0.66) return '#ca8a04'
    return '#ef4444'
  }

  const zones = [
    { id: 'nose', label: 'Nose', x: 10, y: 80, w: 60, h: 60 },
    { id: 'fuselage', label: 'Fuselage', x: 70, y: 70, w: 120, h: 80 },
    { id: 'wing', label: 'Wings', x: 90, y: 10, w: 100, h: 55 },
    { id: 'tail', label: 'Tail', x: 250, y: 75, w: 70, h: 70 },
    { id: 'engine', label: 'Engine', x: 90, y: 155, w: 100, h: 40 },
    { id: 'landing_gear', label: 'Landing Gear', x: 160, y: 155, w: 80, h: 40 },
  ]

  const tailRecordCount = (tail) => records.filter(r => r.tailNumber === tail).length
  const tailRecords = records.filter(r => r.tailNumber === selectedTail)
  const groundCount = tailRecords.filter(r => r.verdict === 'GROUND').length
  const passCount = tailRecords.filter(r => r.verdict === 'PASS').length

  return (
    <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>HistoryGraph</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#64748b', fontSize: 13 }}>{records.length} total</span>
          <button
            onClick={exportReport}
            style={{
              background: '#1e2d40', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: 6,
              padding: '6px 12px', fontSize: 12,
              cursor: 'pointer', fontWeight: 500
            }}
          >
            ⬇ Export Report
          </button>
        </div>
      </div>

      {/* Tail selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ALL_TAILS.map(tail => (
          <button key={tail} onClick={() => setSelectedTail(tail)} style={{
            background: selectedTail === tail ? '#00c2ff' : '#1e2d40',
            color: selectedTail === tail ? '#0a0f1a' : '#94a3b8',
            border: 'none', borderRadius: 6,
            padding: '8px 14px', fontSize: 12,
            fontWeight: selectedTail === tail ? 700 : 400,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
          }}>
            <span>{tail}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{tailRecordCount(tail)} records</span>
          </button>
        ))}
      </div>

      {/* Summary stats */}
      {tailRecords.length > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: '#0f2d1a', border: '1px solid #166534', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ color: '#86efac', fontSize: 20, fontWeight: 700 }}>{passCount}</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>PASS</div>
          </div>
          <div style={{ flex: 1, background: '#2d1a1a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ color: '#fca5a5', fontSize: 20, fontWeight: 700 }}>{groundCount}</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>GROUND</div>
          </div>
          <div style={{ flex: 1, background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>{tailRecords.length}</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>TOTAL</div>
          </div>
        </div>
      )}

      {/* Paris' Law projection */}
      {projection && (
        <div style={{
          background: projection.willBreach ? '#2d1a1a' : '#0f2d1a',
          border: `1px solid ${projection.willBreach ? '#7f1d1d' : '#166534'}`,
          borderRadius: 8, padding: '12px 16px'
        }}>
          <p style={{ color: projection.willBreach ? '#fca5a5' : '#86efac', fontSize: 13, fontWeight: 600 }}>
            {projection.willBreach
              ? `⚠ Crack will exceed tolerance in ~${projection.inspectionsRemaining} inspection cycles (~${projection.hoursRemaining} flight hours)`
              : '✓ Crack within safe growth limits'}
          </p>
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            Paris' Law — Boeing 737 Al 2024-T3 | C=1.35×10⁻¹⁰ | m=3.0
          </p>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            Defect size over inspections — {selectedTail}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" />
              <XAxis dataKey="inspection" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} unit="mm" />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value, name, props) => [`${value}mm`, props.payload.defectType]}
              />
              <ReferenceLine y={TOLERANCE_LIMIT} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: 'Crack tolerance limit', fill: '#ef4444', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="estimatedLengthMM"
                stroke="#00c2ff"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  const color = DEFECT_COLORS[payload.defectType] || '#00c2ff'
                  return <circle key={`dot-${props.index}`} cx={cx} cy={cy} r={5} fill={color} stroke={color} />
                }}
                name="Size (mm)"
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
            {Object.entries(DEFECT_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ color: '#64748b', fontSize: 11, textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 13 }}>No records for {selectedTail} yet.</p>
          <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>Go to LiveScan, select this aircraft, and save a detection.</p>
        </div>
      )}

      {/* Fleet heatmap */}
      <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px' }}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
          Defect frequency by zone — {selectedTail}
        </p>
        <svg viewBox="0 0 340 220" style={{ width: '100%' }}>
          {zones.map(zone => (
            <g key={zone.id}>
              <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                rx={6} fill={zoneColor(zone.id)} stroke="#334155" strokeWidth={1} />
              <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 - 4}
                textAnchor="middle" fill="#e2e8f0" fontSize={9}>{zone.label}</text>
              <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 10}
                textAnchor="middle" fill="#94a3b8" fontSize={9}>{zoneData[zone.id] || 0} defects</text>
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          {[['#1e2d40', 'None'], ['#854d0e', 'Low'], ['#ca8a04', 'Medium'], ['#ef4444', 'High']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
              <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
{/* Emerson NI Sensor Feed */}
      <EmersonNI selectedTail={selectedTail} />

    </div>
    
    
  )
}
