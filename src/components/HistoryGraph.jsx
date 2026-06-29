import { useEffect, useState } from 'react'
import { db } from '../db/db'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from 'recharts'
import EmersonNI from './EmersonNI'

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
  const [hoveredZone, setHoveredZone] = useState(null)
  const TOLERANCE_LIMIT = 4.0
  const C = 1.35e-10
  const M = 3.0

  function exportReport() {
    const tailRecordsToExport = records.filter(r => r.tailNumber === selectedTail)
    const report = {
      exported_at: new Date().toISOString(),
      aircraft: selectedTail,
      aircraft_type: tailRecordsToExport[0]?.aircraftType || 'B737',
      total_inspections: tailRecordsToExport.length,
      ground_count: tailRecordsToExport.filter(r => r.verdict === 'GROUND').length,
      pass_count: tailRecordsToExport.filter(r => r.verdict === 'PASS').length,
      inspectors: [...new Set(tailRecordsToExport.map(r => r.inspectorId))],
      records: tailRecordsToExport.map(r => ({ ...r, imageData: undefined }))
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
    const counts = {
      nose: 0,
      fuselage: 0,
      wing: 0,
      tail: 0,
      engine: 0,
      landing_gear: 0
    }
    records.filter(r => r.tailNumber === selectedTail).forEach(r => {
      const z = r.zone || 'unknown'
      if (z === 'nose') counts.nose++
      else if (z === 'fuselage') counts.fuselage++
      else if (z === 'left_wing' || z === 'right_wing' || z === 'wing') counts.wing++
      else if (z === 'tail') counts.tail++
      else if (z === 'engine') counts.engine++
      else if (z === 'landing_gear') counts.landing_gear++
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


  const renderZone = (zoneId, pathsAndShapes, labels) => {
    const isHovered = hoveredZone === zoneId
    const count = zoneData[zoneId] || 0
    const hasDefects = count > 0
    const severityColor = zoneColor(zoneId)
    
    const strokeColor = hasDefects ? severityColor : '#00c2ff'
    const strokeOpacity = isHovered ? 1.0 : (hasDefects ? 0.9 : 0.45)
    const strokeWidth = isHovered ? 2.0 : 1.2
    const fillOpacity = isHovered ? 0.35 : (hasDefects ? 0.2 : 0.05)
    
    return (
      <g
        key={zoneId}
        onMouseEnter={() => setHoveredZone(zoneId)}
        onMouseLeave={() => setHoveredZone(null)}
        style={{ cursor: 'pointer' }}
      >
        {pathsAndShapes({
          fill: severityColor,
          fillOpacity,
          stroke: strokeColor,
          strokeOpacity,
          strokeWidth,
          filter: isHovered ? 'url(#glow)' : 'none'
        })}
        {labels.map((lbl, idx) => (
          <g key={idx} style={{ pointerEvents: 'none' }}>
            <text
              x={lbl.x}
              y={lbl.y - 2}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={10}
              fontWeight="bold"
              style={{ letterSpacing: '0.02em' }}
            >
              {lbl.title}
            </text>
            <text
              x={lbl.x}
              y={lbl.y + 10}
              textAnchor="middle"
              fill={hasDefects ? severityColor : '#00c2ff'}
              fontSize={8.5}
              fontWeight="600"
              opacity={isHovered ? 1.0 : 0.85}
            >
              {count} {count === 1 ? 'defect' : 'defects'}
            </text>
          </g>
        ))}
      </g>
    )
  }

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
          <button onClick={exportReport} style={{
            background: '#1e2d40', color: '#94a3b8',
            border: '1px solid #334155', borderRadius: 6,
            padding: '6px 12px', fontSize: 12,
            cursor: 'pointer', fontWeight: 500
          }}>⬇ Export</button>
        </div>
      </div>

      {/* Tail selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ALL_TAILS.map(tail => (
          <button key={tail} onClick={() => setSelectedTail(tail)} style={{
            background: selectedTail === tail ? '#00c2ff' : '#1e2d40',
            color: selectedTail === tail ? '#0a0f1a' : '#94a3b8',
            border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12,
            fontWeight: selectedTail === tail ? 700 : 400, cursor: 'pointer',
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

      {/* Recent defect images */}
      {tailRecords.filter(r => r.imageData).length > 0 && (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Recent Captures — {selectedTail}</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {tailRecords.filter(r => r.imageData).slice(-6).reverse().map((r, i) => (
              <div key={i} style={{ flexShrink: 0, position: 'relative' }}>
                <img
                  src={r.imageData}
                  alt={r.defectType}
                  style={{
                    width: 100, height: 70, objectFit: 'cover',
                    borderRadius: 6,
                    border: `2px solid ${r.verdict === 'GROUND' ? '#ef4444' : '#22c55e'}`
                  }}
                />
                <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.75)', borderRadius: 3, padding: '1px 5px' }}>
                  <span style={{ color: '#e2e8f0', fontSize: 9, textTransform: 'capitalize' }}>
                    {r.defectType?.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ position: 'absolute', top: 4, right: 4, background: r.verdict === 'GROUND' ? '#ef4444' : '#22c55e', borderRadius: 3, padding: '1px 5px' }}>
                  <span style={{ color: '#000', fontSize: 9, fontWeight: 700 }}>{r.verdict}</span>
                </div>
              </div>
            ))}
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
                type="monotone" dataKey="estimatedLengthMM" stroke="#00c2ff" strokeWidth={2}
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
        <svg viewBox="0 0 500 450" style={{ width: '100%', background: '#0a0f1a', borderRadius: 8, border: '1px solid #1e2d40' }}>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Nose */}
          {renderZone(
            'nose',
            (props) => (
              <>
                <path d="M 180,205 C 145,205 115,215 115,225 C 115,235 145,245 180,245 Z" {...props} />
              </>
            ),
            [{ x: 145, y: 224, title: 'Nose' }]
          )}

          {/* Fuselage */}
          {renderZone(
            'fuselage',
            (props) => (
              <>
                <rect x={180} y={205} width={200} height={40} rx={4} {...props} />
                <line x1={230} y1={205} x2={230} y2={245} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
                <line x1={280} y1={205} x2={280} y2={245} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
                <line x1={330} y1={205} x2={330} y2={245} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
                <path d="M 168,212 Q 175,212 178,218 L 170,218 Z" fill={props.stroke} opacity={props.strokeOpacity * 0.5} />
              </>
            ),
            [{ x: 280, y: 224, title: 'Fuselage' }]
          )}

          {/* Wings */}
          {renderZone(
            'wing',
            (props) => (
              <>
                {/* Top Wing */}
                <path d="M 250,205 L 325,50 L 335,50 L 285,205 Z" {...props} />
                <path d="M 325,50 L 321,42 L 335,50 Z" {...props} />
                <line x1={255} y1={194} x2={325} y2={54} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.7} />
                <line x1={278} y1={194} x2={328} y2={74} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.5} />

                {/* Bottom Wing */}
                <path d="M 250,245 L 325,400 L 335,400 L 285,245 Z" {...props} />
                <path d="M 325,400 L 321,408 L 335,400 Z" {...props} />
                <line x1={255} y1={256} x2={325} y2={396} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.7} />
                <line x1={278} y1={256} x2={328} y2={376} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.5} />
              </>
            ),
            [
              { x: 325, y: 90, title: 'Wings' },
              { x: 325, y: 360, title: 'Wings' }
            ]
          )}

          {/* Tail */}
          {renderZone(
            'tail',
            (props) => (
              <>
                <path d="M 380,205 L 430,130 L 445,130 L 410,225 L 445,320 L 430,320 L 380,245 Z" {...props} />
                <line x1={395} y1={215} x2={425} y2={150} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
                <line x1={395} y1={235} x2={425} y2={300} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
              </>
            ),
            [{ x: 415, y: 224, title: 'Tail' }]
          )}

          {/* Engine */}
          {renderZone(
            'engine',
            (props) => (
              <>
                <rect x={190} y={175} width={45} height={24} rx={3} {...props} />
                <rect x={190} y={251} width={45} height={24} rx={3} {...props} />
              </>
            ),
            [
              { x: 190, y: 160, title: 'Engine' },
              { x: 190, y: 295, title: 'Engine' }
            ]
          )}

          {/* Landing Gear */}
          {renderZone(
            'landing_gear',
            (props) => (
              <>
                {/* Large Invisible Hit Boxes */}
                <rect x={235} y={175} width={40} height={40} fill="transparent" pointerEvents="auto" />
                <rect x={235} y={235} width={40} height={40} fill="transparent" pointerEvents="auto" />

                {/* Top Landing Gear */}
                <rect x={245} y={185} width={20} height={20} rx={2} fill={props.fill} fillOpacity={props.fillOpacity} stroke={props.stroke} strokeWidth={props.strokeWidth} strokeDasharray="3,3" opacity={props.strokeOpacity} filter={props.filter} />
                <line x1={255} y1={205} x2={255} y2={195} stroke={props.stroke} strokeWidth={props.strokeWidth} opacity={props.strokeOpacity} />
                <line x1={246} y1={195} x2={264} y2={195} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.8} opacity={props.strokeOpacity} />
                <rect x={244} y={190} width={4} height={10} rx={1} fill={props.stroke} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity} />
                <rect x={262} y={190} width={4} height={10} rx={1} fill={props.stroke} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity} />
                
                {/* Bottom Landing Gear */}
                <rect x={245} y={245} width={20} height={20} rx={2} fill={props.fill} fillOpacity={props.fillOpacity} stroke={props.stroke} strokeWidth={props.strokeWidth} strokeDasharray="3,3" opacity={props.strokeOpacity} filter={props.filter} />
                <line x1={255} y1={245} x2={255} y2={255} stroke={props.stroke} strokeWidth={props.strokeWidth} opacity={props.strokeOpacity} />
                <line x1={246} y1={255} x2={264} y2={255} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.8} opacity={props.strokeOpacity} />
                <rect x={244} y={250} width={4} height={10} rx={1} fill={props.stroke} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity} />
                <rect x={262} y={250} width={4} height={10} rx={1} fill={props.stroke} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity} />
              </>
            ),
            [
              { x: 255, y: 125, title: 'Landing Gear' },
              { x: 255, y: 325, title: 'Landing Gear' }
            ]
          )}
        </svg>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
          {[['#1e2d40', 'None'], ['#854d0e', 'Low'], ['#ca8a04', 'Medium'], ['#ef4444', 'High']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
              <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Emerson NI */}
      <EmersonNI selectedTail={selectedTail} />

    </div>
  )
}