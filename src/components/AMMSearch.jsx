import { useState, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'
import procedures from '../data/amm_procedures.json'

const fuse = new Fuse(procedures, {
  keys: ['defect_type', 'zone', 'title', 'procedure', 'ata_chapter'],
  threshold: 0.4,
  includeScore: true
})

export default function AMMSearch({ defectType, zone }) {
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [locked, setLocked] = useState(false)
  const prevKey = useRef(null)

  // only reset if defect type AND zone both change — not on every detection cycle
  useEffect(() => {
    const key = `${defectType}-${zone}`
    if (key !== prevKey.current && !locked) {
      setResult(null)
      setSearched(false)
      prevKey.current = key
    }
  }, [defectType, zone, locked])

  function search() {
    const exact = procedures.find(
      p => p.defect_type === defectType && p.zone === zone
    )

    if (exact) {
      setResult(exact)
    } else {
      const query = `${defectType} ${zone?.replace(/_/g, ' ')}`
      const results = fuse.search(query)
      setResult(results.length > 0 ? results[0].item : null)
    }
    setSearched(true)
    setLocked(true) // lock result so detection cycle doesn't clear it
  }

  function clear() {
    setResult(null)
    setSearched(false)
    setLocked(false)
  }

  const categoryColor = (cat) => {
    if (!cat) return '#64748b'
    if (cat.includes('Category A')) return '#ef4444'
    if (cat.includes('Category B')) return '#f59e0b'
    if (cat.includes('Category C')) return '#3b82f6'
    return '#22c55e'
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {!locked ? (
        <button
          onClick={search}
          disabled={!defectType}
          style={{
            background: defectType ? '#1e3a5f' : '#1e2d40',
            color: defectType ? '#93c5fd' : '#475569',
            border: `1px solid ${defectType ? '#3b82f6' : '#1e2d40'}`,
            borderRadius: 8, padding: '10px 0',
            fontSize: 13, fontWeight: 600,
            cursor: defectType ? 'pointer' : 'not-allowed',
            width: '100%'
          }}
        >
          📋 Get Repair Procedure
        </button>
      ) : (
        <button
          onClick={clear}
          style={{
            background: 'transparent',
            color: '#475569',
            border: '1px solid #1e2d40',
            borderRadius: 8, padding: '8px 0',
            fontSize: 12, cursor: 'pointer', width: '100%'
          }}
        >
          ✕ Clear Procedure
        </button>
      )}

      {searched && !result && (
        <div style={{ background: '#1e2d40', borderRadius: 8, padding: '12px 16px' }}>
          <p style={{ color: '#64748b', fontSize: 13 }}>No procedure found for this combination.</p>
        </div>
      )}

      {result && (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Title + category */}
          <div>
            <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{result.title}</p>
            <span style={{
              background: categoryColor(result.repair_category) + '22',
              color: categoryColor(result.repair_category),
              border: `1px solid ${categoryColor(result.repair_category)}`,
              borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
            }}>{result.repair_category}</span>
          </div>

          {/* Procedure */}
          <div style={{ background: '#0a0f1a', borderRadius: 6, padding: '10px 12px' }}>
            <p style={{ color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedure</p>
            <p style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.7 }}>{result.procedure}</p>
          </div>

          {/* Tools */}
          <div>
            <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools Required</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.tools_required.map((tool, i) => (
                <span key={i} style={{ background: '#1e2d40', color: '#94a3b8', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>{tool}</span>
              ))}
            </div>
          </div>

          {/* Sign offs */}
          <div>
            <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Required Sign-offs</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.sign_offs.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#f59e0b', fontSize: 12 }}>✓</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e2d40', paddingTop: 10 }}>
            <span style={{ color: '#475569', fontSize: 11 }}>{result.ata_chapter}</span>
            <span style={{ color: '#475569', fontSize: 11 }}>{result.ad_reference}</span>
          </div>

        </div>
      )}
    </div>
  )
}