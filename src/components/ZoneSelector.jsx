export default function ZoneSelector({ selectedZone, onZoneSelect }) {
  const zones = [
    { id: 'nose', label: 'Nose', x: 10, y: 80, w: 60, h: 60 },
    { id: 'fuselage_front', label: 'Fuse Front', x: 70, y: 70, w: 90, h: 80 },
    { id: 'fuselage_rear', label: 'Fuse Rear', x: 160, y: 70, w: 90, h: 80 },
    { id: 'left_wing', label: 'Left Wing', x: 90, y: 10, w: 100, h: 55 },
    { id: 'right_wing', label: 'Right Wing', x: 90, y: 155, w: 100, h: 55 },
    { id: 'tail', label: 'Tail', x: 250, y: 75, w: 70, h: 70 },
  ]

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>
        Tap the zone where the defect was found
      </p>
      <svg
        viewBox="0 0 340 220"
        style={{ width: '100%', background: '#111827', borderRadius: 8, border: '1px solid #1e2d40' }}
      >
        {zones.map(zone => (
          <g key={zone.id} onClick={() => onZoneSelect(zone.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={zone.x} y={zone.y} width={zone.w} height={zone.h}
              rx={6}
              fill={selectedZone === zone.id ? '#00c2ff' : '#1e2d40'}
              stroke={selectedZone === zone.id ? '#00c2ff' : '#334155'}
              strokeWidth={1.5}
              opacity={selectedZone === zone.id ? 0.9 : 0.6}
            />
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 + 4}
              textAnchor="middle"
              fill={selectedZone === zone.id ? '#0a0f1a' : '#94a3b8'}
              fontSize={9}
              fontWeight={selectedZone === zone.id ? '700' : '400'}
            >
              {zone.label}
            </text>
          </g>
        ))}
      </svg>
      {selectedZone && (
        <p style={{ color: '#00c2ff', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          ✓ Zone selected: <strong>{selectedZone.replace(/_/g, ' ').toUpperCase()}</strong>
        </p>
      )}
    </div>
  )
}