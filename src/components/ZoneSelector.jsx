export default function ZoneSelector({ selectedZone, onZoneSelect }) {
  const renderClickableZone = (zoneId, pathsAndShapes, label) => {
    const isSelected = selectedZone === zoneId
    const strokeColor = isSelected ? '#00c2ff' : '#38bdf8'
    const strokeOpacity = isSelected ? 1.0 : 0.45
    const strokeWidth = isSelected ? 2.0 : 1.2
    const fill = isSelected ? '#00c2ff' : '#1e2d40'
    const fillOpacity = isSelected ? 0.35 : 0.05
    
    return (
      <g
        onClick={() => onZoneSelect(zoneId)}
        style={{ cursor: 'pointer' }}
      >
        {pathsAndShapes({
          fill,
          fillOpacity,
          stroke: strokeColor,
          strokeOpacity,
          strokeWidth,
          filter: isSelected ? 'url(#glow-select)' : 'none'
        })}
        {label && (
          <g style={{ pointerEvents: 'none' }}>
            <text
              x={label.x}
              y={label.y - 2}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={10}
              fontWeight={isSelected ? 'bold' : 'normal'}
              style={{ letterSpacing: '0.02em', opacity: isSelected ? 1.0 : 0.75 }}
            >
              {label.title}
            </text>
            <text
              x={label.x}
              y={label.y + 10}
              textAnchor="middle"
              fill={isSelected ? '#00c2ff' : '#64748b'}
              fontSize={8}
              fontWeight="bold"
              opacity={isSelected ? 1.0 : 0.7}
            >
              {isSelected ? '✓ ACTIVE' : 'SELECT'}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 450 }}>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
        Tap the zone where the defect was found
      </p>
      <svg
        viewBox="0 0 500 450"
        style={{ width: '100%', background: '#0a0f1a', borderRadius: 8, border: '1px solid #1e2d40' }}
      >
        <defs>
          <filter id="glow-select" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Decorative Engines */}
        <rect x={190} y={175} width={45} height={24} rx={3} fill="none" stroke="#00c2ff" strokeWidth={1.2} opacity={0.2} />
        <rect x={190} y={251} width={45} height={24} rx={3} fill="none" stroke="#00c2ff" strokeWidth={1.2} opacity={0.2} />

        {/* Decorative Landing Gear */}
        <rect x={245} y={185} width={20} height={20} rx={2} fill="none" stroke="#00c2ff" strokeWidth={1.2} strokeDasharray="3,3" opacity={0.2} />
        <line x1={255} y1={205} x2={255} y2={195} stroke="#00c2ff" strokeWidth={1.2} opacity={0.2} />
        <line x1={246} y1={195} x2={264} y2={195} stroke="#00c2ff" strokeWidth={0.9} opacity={0.2} />
        <rect x={244} y={190} width={4} height={10} rx={1} fill="#00c2ff" stroke="#00c2ff" strokeWidth={0.5} opacity={0.2} />
        <rect x={262} y={190} width={4} height={10} rx={1} fill="#00c2ff" stroke="#00c2ff" strokeWidth={0.5} opacity={0.2} />
        
        <rect x={245} y={245} width={20} height={20} rx={2} fill="none" stroke="#00c2ff" strokeWidth={1.2} strokeDasharray="3,3" opacity={0.2} />
        <line x1={255} y1={245} x2={255} y2={255} stroke="#00c2ff" strokeWidth={1.2} opacity={0.2} />
        <line x1={246} y1={255} x2={264} y2={255} stroke="#00c2ff" strokeWidth={0.9} opacity={0.2} />
        <rect x={244} y={250} width={4} height={10} rx={1} fill="#00c2ff" stroke="#00c2ff" strokeWidth={0.5} opacity={0.2} />
        <rect x={262} y={250} width={4} height={10} rx={1} fill="#00c2ff" stroke="#00c2ff" strokeWidth={0.5} opacity={0.2} />

        {/* Nose */}
        {renderClickableZone(
          'nose',
          (props) => (
            <path d="M 180,205 C 145,205 115,215 115,225 C 115,235 145,245 180,245 Z" {...props} />
          ),
          { x: 145, y: 224, title: 'Nose' }
        )}

        {/* Fuse Front */}
        {renderClickableZone(
          'fuselage_front',
          (props) => (
            <>
              <path d="M 180,205 L 280,205 L 280,245 L 180,245 Z" {...props} />
              <line x1={230} y1={205} x2={230} y2={245} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
              <path d="M 168,212 Q 175,212 178,218 L 170,218 Z" fill={props.stroke} opacity={props.strokeOpacity * 0.5} />
            </>
          ),
          { x: 230, y: 224, title: 'Fuse Front' }
        )}

        {/* Fuse Rear */}
        {renderClickableZone(
          'fuselage_rear',
          (props) => (
            <>
              <path d="M 280,205 L 380,205 L 380,245 L 280,245 Z" {...props} />
              <line x1={330} y1={205} x2={330} y2={245} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
            </>
          ),
          { x: 330, y: 224, title: 'Fuse Rear' }
        )}

        {/* Left Wing */}
        {renderClickableZone(
          'left_wing',
          (props) => (
            <>
              <path d="M 250,205 L 325,50 L 335,50 L 285,205 Z" {...props} />
              <path d="M 325,50 L 321,42 L 335,50 Z" {...props} />
              <line x1={255} y1={194} x2={325} y2={54} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.7} />
              <line x1={278} y1={194} x2={328} y2={74} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.5} />
            </>
          ),
          { x: 325, y: 90, title: 'Left Wing' }
        )}

        {/* Right Wing */}
        {renderClickableZone(
          'right_wing',
          (props) => (
            <>
              <path d="M 250,245 L 325,400 L 335,400 L 285,245 Z" {...props} />
              <path d="M 325,400 L 321,408 L 335,400 Z" {...props} />
              <line x1={255} y1={256} x2={325} y2={396} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.7} />
              <line x1={278} y1={256} x2={328} y2={376} stroke={props.stroke} strokeWidth={0.5} opacity={props.strokeOpacity * 0.5} />
            </>
          ),
          { x: 325, y: 360, title: 'Right Wing' }
        )}

        {/* Tail */}
        {renderClickableZone(
          'tail',
          (props) => (
            <>
              <path d="M 380,205 L 430,130 L 445,130 L 410,225 L 445,320 L 430,320 L 380,245 Z" {...props} />
              <line x1={395} y1={215} x2={425} y2={150} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
              <line x1={395} y1={235} x2={425} y2={300} stroke={props.stroke} strokeWidth={props.strokeWidth * 0.4} opacity={props.strokeOpacity * 0.7} />
            </>
          ),
          { x: 415, y: 224, title: 'Tail' }
        )}
      </svg>
      {selectedZone && (
        <p style={{ color: '#00c2ff', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          ✓ Zone selected: <strong>{selectedZone.replace(/_/g, ' ').toUpperCase()}</strong>
        </p>
      )}
    </div>
  )
}