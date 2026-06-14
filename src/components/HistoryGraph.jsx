import { useEffect, useState } from 'react'
import { db } from '../db/db'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'

export default function HistoryGraph() {
  const [records, setRecords] = useState([])
  const [selectedTail, setSelectedTail] = useState('VT-TEST-001')
  const [tailNumbers, setTailNumbers] = useState([])
  const [chartData, setChartData] = useState([])
  const [projection, setProjection] = useState(null)
  const TOLERANCE_LIMIT = 4.0

  const C = 1.35e-10
  const M = 3.0

  function parisLawProject(inspections) {
    if (inspections.length < 2) return null
    const last = inspections[inspections.length - 1]
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

      const tails = [...new Set(all.map(r => r.tailNumber).filter(Boolean))]
      setTailNumbers(tails)
      if (tails.length > 0 && !tails.includes(selectedTail)) {
        setSelectedTail(tails[0])
      }
    }
    loadRecords()
    const interval = setInterval(loadRecords, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const filtered = records
      .filter(r => r.tailNumber === selectedTail && r.defectType === 'crack')
      .sort((a, b) => new Date(a.inspectionDate) - new Date(b.inspectionDate))
      .map((r, i) => ({
        inspection: `#${i + 1}`,
        estimatedLengthMM: r.estimatedLengthMM,
        timestamp: new Date(r.inspectionDate).toLocaleTimeString()
      }))

    setChartData(filtered)
    const proj = parisLawProject(filtered)
    setProjection(proj)
  }, [records, selectedTail])

  // zone heatmap — using zone field
  const zoneData = (() => {
    const counts = {}
    records.forEach(r => {
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

  return (
    <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>HistoryGraph</h2>
        <span style={{ color: '#64748b', fontSize: 13 }}>{records.length} total records</span>
      </div>

      {/* Tail selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tailNumbers.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13 }}>No records yet — save a detection from LiveScan first.</p>
        ) : tailNumbers.map(tail => (
          <button key={tail} onClick={() => setSelectedTail(tail)} style={{
            background: selectedTail === tail ? '#00c2ff' : '#1e2d40',
            color: selectedTail === tail ? '#0a0f1a' : '#94a3b8',
            border: 'none', borderRadius: 6,
            padding: '6px 14px', fontSize: 13,
            fontWeight: selectedTail === tail ? 700 : 400,
            cursor: 'pointer'
          }}>{tail}</button>
        ))}
      </div>

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

      {/* Crack growth chart */}
      {chartData.length > 0 ? (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            Crack length over inspections — {selectedTail}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" />
              <XAxis dataKey="inspection" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} unit="mm" />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 6 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#00c2ff' }}
              />
              <ReferenceLine y={TOLERANCE_LIMIT} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: 'Tolerance limit', fill: '#ef4444', fontSize: 11 }} />
              <Line type="monotone" dataKey="estimatedLengthMM" stroke="#00c2ff"
                strokeWidth={2} dot={{ fill: '#00c2ff', r: 4 }} name="Crack length (mm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 13 }}>No crack records yet. Start LiveScan to populate this chart.</p>
        </div>
      )}

      {/* Fleet heatmap */}
      <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px' }}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Fleet heatmap — defect frequency by zone</p>
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

    </div>
  )
}