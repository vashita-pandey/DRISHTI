import { useState } from 'react'
import niFeed from '../data/emerson_ni_feed.json'

export default function EmersonNI({ selectedTail }) {
  const [expanded, setExpanded] = useState(null)

  const tailReadings = niFeed.filter(r => r.tailNumber === selectedTail)
  const anomalies = tailReadings.filter(r => r.status === 'ANOMALY')
  const normal = tailReadings.filter(r => r.status === 'NORMAL')

  if (tailReadings.length === 0) return null

  return (
    <div style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 8, padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ color: '#93c5fd', fontSize: 13, fontWeight: 600 }}>
            🔌 Emerson NI Sensor Feed
          </p>
          <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
            Live data from NI test & measurement hardware
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {anomalies.length > 0 && (
            <span style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {anomalies.length} ANOMALY
            </span>
          )}
          <span style={{ background: '#0f2d1a', color: '#86efac', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
            {normal.length} NORMAL
          </span>
        </div>
      </div>

      {/* Sensor readings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tailReadings.map((reading, i) => (
          <div
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              background: '#0a0f1a',
              border: `1px solid ${reading.status === 'ANOMALY' ? '#7f1d1d' : '#166534'}`,
              borderRadius: 6, padding: '10px 12px',
              cursor: 'pointer'
            }}
          >
            {/* Summary row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
                  {reading.sensor_type}
                </span>
                <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>
                  {reading.model}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#64748b', fontSize: 11 }}>
                  {reading.zone.replace('_', ' ')}
                </span>
                <span style={{
                  background: reading.status === 'ANOMALY' ? '#7f1d1d' : '#14532d',
                  color: reading.status === 'ANOMALY' ? '#fca5a5' : '#86efac',
                  borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700
                }}>
                  {reading.status}
                </span>
                <span style={{ color: '#475569', fontSize: 11 }}>
                  {expanded === i ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === i && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e2d40', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(reading.reading).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569', fontSize: 11 }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500 }}>
                      {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTop: '1px solid #1e2d40' }}>
                  <span style={{ color: '#475569', fontSize: 11 }}>Sensor ID</span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{reading.sensor_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569', fontSize: 11 }}>Confidence</span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{(reading.reading.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569', fontSize: 11 }}>Timestamp</span>
                  <span style={{ color: '#475569', fontSize: 11 }}>{new Date(reading.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <p style={{ color: '#1e3a5f', fontSize: 10, marginTop: 10, textAlign: 'center' }}>
        Emerson Test & Measurement × DRISHTI Edge AI Integration
      </p>
    </div>
  )
}