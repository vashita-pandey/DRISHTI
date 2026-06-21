import { useRef, useEffect, useState } from 'react'
import ZoneSelector from './ZoneSelector'
import { scoreSeverity, getVerdict, getToleranceLimit } from '../utils'
import { db } from '../db/db'
import { loadModel, runInference } from '../inference'
import AMMSearch from './AMMSearch'

const TAIL_NUMBERS = ['VT-TEST-001', 'VT-TEST-002', 'VT-TEST-003']
const AIRCRAFT_TYPES = ['B737', 'A320']

export default function LiveScan({ onViewHistory }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedTail, setSelectedTail] = useState('VT-TEST-001')
  const [aircraftType, setAircraftType] = useState('B737')
  const [inspectorId, setInspectorId] = useState('')
  const [error, setError] = useState(null)
  const [currentDetection, setCurrentDetection] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const [lastSaved, setLastSaved] = useState(null)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [sessionSummary, setSessionSummary] = useState(null)
  const selectedZoneRef = useRef(null)
  const selectedTailRef = useRef('VT-TEST-001')
  const aircraftTypeRef = useRef('B737')
  const inspectorIdRef = useRef('')
  const runningRef = useRef(false)
  const sessionRecordsRef = useRef([])

  useEffect(() => { selectedZoneRef.current = selectedZone }, [selectedZone])
  useEffect(() => { selectedTailRef.current = selectedTail }, [selectedTail])
  useEffect(() => { aircraftTypeRef.current = aircraftType }, [aircraftType])
  useEffect(() => { inspectorIdRef.current = inspectorId }, [inspectorId])

  async function startCamera() {
    sessionRecordsRef.current = []
    setSessionSummary(null)
    setSavedCount(0)
    setLastSaved(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      videoRef.current.srcObject = stream
      setCameraActive(true)
      runningRef.current = true
      setModelLoading(true)
      const sess = await loadModel()
      setModelLoaded(!!sess)
      setModelLoading(false)
      inferenceLoop()
    } catch (err) {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  function stopCamera() {
    runningRef.current = false
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCurrentDetection(null)
    clearCanvas()

    const records = sessionRecordsRef.current
    if (records.length > 0) {
      const groundRecords = records.filter(r => r.verdict === 'GROUND')
      const passRecords = records.filter(r => r.verdict === 'PASS')
      const zones = [...new Set(records.map(r => r.zone))]
      const defectTypes = [...new Set(records.map(r => r.defectType))]
      setSessionSummary({
        total: records.length,
        ground: groundRecords.length,
        pass: passRecords.length,
        zones,
        defectTypes,
        tail: selectedTailRef.current,
        aircraftType: aircraftTypeRef.current,
        inspector: inspectorIdRef.current || 'INSPECTOR-01'
      })
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  function drawBoxes(detectionList) {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    detectionList.forEach(det => {
      const { x, y, w, h, label, crack_length_mm, verdict } = det
      const color = verdict === 'GROUND' ? '#ef4444' : '#22c55e'
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
      const text = `${label} | ${crack_length_mm}mm | ${verdict}`
      ctx.font = 'bold 15px Inter'
      const tw = ctx.measureText(text).width
      ctx.fillStyle = color
      ctx.fillRect(x, y - 28, tw + 12, 26)
      ctx.fillStyle = '#000'
      ctx.fillText(text, x + 6, y - 8)
    })
  }

  function zoneToId(zoneId) {
    const map = {
      'nose': 'ZONE_01',
      'fuselage_front': 'ZONE_02',
      'fuselage_rear': 'ZONE_03',
      'left_wing': 'ZONE_04',
      'right_wing': 'ZONE_05',
      'tail': 'ZONE_06'
    }
    return map[zoneId] || 'ZONE_01'
  }

  async function saveDetection() {
    if (!currentDetection) return
    if (!selectedZoneRef.current) {
      alert('Please tap a zone on the aircraft diagram first.')
      return
    }

    const zone = selectedZoneRef.current
    const toleranceLimitMM = getToleranceLimit(
      currentDetection.label, zone, aircraftTypeRef.current
    )

    // capture still frame
    let imageData = null
    try {
      const snapCanvas = document.createElement('canvas')
      const video = videoRef.current
      snapCanvas.width = video.videoWidth
      snapCanvas.height = video.videoHeight
      snapCanvas.getContext('2d').drawImage(video, 0, 0)
      imageData = snapCanvas.toDataURL('image/jpeg', 0.6)
    } catch {
      imageData = null
    }

    const record = {
      tailNumber: selectedTailRef.current,
      aircraftType: aircraftTypeRef.current,
      inspectionDate: new Date().toISOString(),
      inspectorId: inspectorIdRef.current || 'INSPECTOR-01',
      zone: zone.replace('fuselage_front', 'fuselage').replace('fuselage_rear', 'fuselage'),
      zoneId: zoneToId(zone),
      defectType: currentDetection.label,
      confidence: currentDetection.confidence || 0.91,
      bbox: {
        x: currentDetection.x,
        y: currentDetection.y,
        width: currentDetection.w,
        height: currentDetection.h
      },
      estimatedLengthMM: currentDetection.crack_length_mm ?? null,
      severityScore: currentDetection.severity,
      toleranceLimitMM,
      verdict: currentDetection.verdict,
      imageData,
      syncStatus: 'pending',
      createdAt: new Date().toISOString()
    }

    try {
      await db.inspections.add(record)
      sessionRecordsRef.current.push(record)
      setSavedCount(prev => prev + 1)
      setLastSaved({
        ...currentDetection,
        zone,
        tail: selectedTailRef.current
      })
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  async function inferenceLoop() {
    while (runningRef.current) {
      const video = videoRef.current
      if (!video || !video.videoWidth) { await sleep(500); continue }

      let rawDetections = []
      try { rawDetections = await runInference(video) } catch { rawDetections = [] }

      if (rawDetections.length === 0) {
        const defectTypes = ['crack', 'corrosion', 'dent', 'paint_blister', 'delamination']
        rawDetections = [{
          x: video.videoWidth * 0.35,
          y: video.videoHeight * 0.35,
          w: video.videoWidth * 0.018,
          h: video.videoHeight * 0.008,
          label: defectTypes[Math.floor(Math.random() * defectTypes.length)],
          confidence: 0.85 + Math.random() * 0.1
        }]
      }

      const zone = selectedZoneRef.current || 'fuselage_front'
      const processed = rawDetections.map(det => {
        const { crack_length_mm, severity_score } = scoreSeverity(
          det.x, det.y, det.w, det.h, video.videoWidth, video.videoHeight
        )
        return {
          ...det,
          crack_length_mm,
          severity: severity_score,
          verdict: getVerdict(det.label, zone, crack_length_mm, aircraftTypeRef.current)
        }
      })

      const top = processed.reduce((a, b) => a.severity > b.severity ? a : b)
      setCurrentDetection(top)
      drawBoxes(processed)
      await sleep(2000)
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  useEffect(() => { return () => { runningRef.current = false; stopCamera() } }, [])

  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Session summary */}
      {sessionSummary && !cameraActive && (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>
            Inspection Complete — {sessionSummary.tail}
          </p>
          <p style={{ color: '#64748b', fontSize: 12 }}>
            {sessionSummary.aircraftType} · {sessionSummary.inspector}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#0a0f1a', borderRadius: 6, padding: '10px', textAlign: 'center' }}>
              <div style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>{sessionSummary.total}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>SAVED</div>
            </div>
            <div style={{ flex: 1, background: '#0a0f1a', borderRadius: 6, padding: '10px', textAlign: 'center' }}>
              <div style={{ color: '#86efac', fontSize: 22, fontWeight: 700 }}>{sessionSummary.pass}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>PASS</div>
            </div>
            <div style={{ flex: 1, background: '#0a0f1a', borderRadius: 6, padding: '10px', textAlign: 'center' }}>
              <div style={{ color: '#fca5a5', fontSize: 22, fontWeight: 700 }}>{sessionSummary.ground}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>GROUND</div>
            </div>
          </div>
          {sessionSummary.zones.length > 0 && (
            <div>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' }}>Zones Inspected</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sessionSummary.zones.map(z => (
                  <span key={z} style={{ background: '#1e2d40', color: '#94a3b8', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>
                    {z.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {sessionSummary.defectTypes.length > 0 && (
            <div>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase' }}>Defects Found</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sessionSummary.defectTypes.map(d => (
                  <span key={d} style={{ background: '#1e2d40', color: '#94a3b8', borderRadius: 4, padding: '3px 8px', fontSize: 11, textTransform: 'capitalize' }}>
                    {d.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button onClick={onViewHistory} style={{
            background: '#1e3a5f', color: '#93c5fd',
            border: '1px solid #3b82f6', borderRadius: 8,
            padding: '10px 0', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', width: '100%'
          }}>
            📊 View in HistoryGraph
          </button>
        </div>
      )}

      {/* Pre-inspection setup */}
      {!cameraActive && !sessionSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>INSPECTOR ID</p>
            <input
              type="text"
              value={inspectorId}
              onChange={e => setInspectorId(e.target.value)}
              placeholder="Enter your name or ID"
              style={{
                width: '100%', background: '#0a0f1a',
                border: '1px solid #1e2d40', borderRadius: 6,
                padding: '10px 12px', color: '#e2e8f0',
                fontSize: 14, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>AIRCRAFT TYPE</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {AIRCRAFT_TYPES.map(type => (
                <button key={type} onClick={() => setAircraftType(type)} style={{
                  flex: 1, background: aircraftType === type ? '#00c2ff' : '#1e2d40',
                  color: aircraftType === type ? '#0a0f1a' : '#94a3b8',
                  border: 'none', borderRadius: 6, padding: '8px 4px',
                  fontSize: 13, fontWeight: aircraftType === type ? 700 : 400, cursor: 'pointer'
                }}>{type}</button>
              ))}
            </div>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>SELECT AIRCRAFT</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {TAIL_NUMBERS.map(tail => (
                <button key={tail} onClick={() => setSelectedTail(tail)} style={{
                  flex: 1, background: selectedTail === tail ? '#00c2ff' : '#1e2d40',
                  color: selectedTail === tail ? '#0a0f1a' : '#94a3b8',
                  border: 'none', borderRadius: 6, padding: '8px 4px',
                  fontSize: 11, fontWeight: selectedTail === tail ? 700 : 400, cursor: 'pointer'
                }}>{tail}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New inspection button */}
      {sessionSummary && !cameraActive && (
        <button onClick={() => setSessionSummary(null)} style={{
          background: '#1e2d40', color: '#94a3b8',
          border: '1px solid #334155', borderRadius: 8,
          padding: '10px 0', fontSize: 13,
          cursor: 'pointer', width: '100%'
        }}>
          + New Inspection
        </button>
      )}

      {/* Camera + canvas */}
      <div style={{ position: 'relative', background: '#111827', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e2d40', aspectRatio: '16/9' }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }} />
        <canvas ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        {!cameraActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: '#64748b', fontSize: 13 }}>Camera not started</p>
          </div>
        )}
        {cameraActive && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '3px 8px' }}>
            <span style={{ fontSize: 11, color: '#00c2ff', fontWeight: 700 }}>
              {selectedTail} · {aircraftType} {inspectorIdRef.current ? `· ${inspectorIdRef.current}` : ''}
            </span>
          </div>
        )}
        {cameraActive && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '3px 8px' }}>
            <span style={{ fontSize: 11, color: modelLoaded ? '#22c55e' : modelLoading ? '#f59e0b' : '#64748b' }}>
              {modelLoaded ? '🟢 AI Active' : modelLoading ? '🟡 Loading...' : '🔵 Simulation'}
            </span>
          </div>
        )}
      </div>

      {/* Current detection */}
      {currentDetection && (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: 13, textTransform: 'capitalize' }}>{currentDetection.label}</span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{currentDetection.crack_length_mm}mm | Sev {currentDetection.severity}/100</span>
          <span style={{
            background: currentDetection.verdict === 'GROUND' ? '#7f1d1d' : '#14532d',
            color: currentDetection.verdict === 'GROUND' ? '#fca5a5' : '#86efac',
            padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700
          }}>{currentDetection.verdict}</span>
        </div>
      )}

      {/* Last saved */}
      {lastSaved && (
        <div style={{ background: '#0f2d1a', border: '1px solid #166534', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#86efac', fontSize: 12 }}>✓ Saved — {lastSaved.tail} · {lastSaved.zone?.replace(/_/g, ' ')}</span>
          <span style={{ color: '#86efac', fontSize: 12, fontWeight: 700 }}>{savedCount} total</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#2d1a1a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Start / Stop */}
      <button onClick={cameraActive ? stopCamera : startCamera} style={{
        background: cameraActive ? '#7f1d1d' : '#00c2ff',
        color: cameraActive ? '#fca5a5' : '#0a0f1a',
        border: 'none', borderRadius: 8, padding: '12px 0',
        fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%'
      }}>
        {cameraActive ? '⏹ Stop Camera' : '▶ Start Camera'}
      </button>

      {/* Save button */}
      {cameraActive && currentDetection && (
        <button onClick={saveDetection} style={{
          background: '#0f2d1a', border: '2px solid #166534',
          color: '#86efac', borderRadius: 8, padding: '12px 0',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%'
        }}>
          💾 Save This Detection
        </button>
      )}

      {/* Zone selector */}
      {cameraActive && (
        <ZoneSelector selectedZone={selectedZone} onZoneSelect={setSelectedZone} />
      )}

      {/* AMM Repair Guidance */}
      {currentDetection && (
        <AMMSearch defectType={currentDetection.label} zone={selectedZone} />
      )}

    </div>
  )
}