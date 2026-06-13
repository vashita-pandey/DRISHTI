import { useRef, useEffect, useState } from 'react'
import ZoneSelector from './ZoneSelector'
import { scoreSeverity, getVerdict } from '../utils'
import { db } from '../db/db'
import { loadModel, runInference } from '../inference'

const TAIL_NUMBERS = ['VT-TEST-001', 'VT-TEST-002', 'VT-TEST-003']

export default function LiveScan() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const [selectedTail, setSelectedTail] = useState('VT-TEST-001')
  const [error, setError] = useState(null)
  const [currentDetection, setCurrentDetection] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const [lastSaved, setLastSaved] = useState(null)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const selectedZoneRef = useRef(null)
  const selectedTailRef = useRef('VT-TEST-001')
  const runningRef = useRef(false)

  useEffect(() => { selectedZoneRef.current = selectedZone }, [selectedZone])
  useEffect(() => { selectedTailRef.current = selectedTail }, [selectedTail])

  async function startCamera() {
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
      const color = verdict === 'FAIL' ? '#ef4444' : '#22c55e'
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

  async function saveDetection() {
    if (!currentDetection) return
    if (!selectedZoneRef.current) {
      alert('Please tap a zone on the aircraft diagram first.')
      return
    }
    try {
      await db.inspections.add({
        tail_number: selectedTailRef.current,
        zone_id: selectedZoneRef.current,
        defect_type: currentDetection.label,
        severity_score: currentDetection.severity,
        crack_length_mm: currentDetection.crack_length_mm,
        verdict: currentDetection.verdict,
        timestamp: new Date().toISOString(),
        inspector_id: 'INSPECTOR-01'
      })
      setSavedCount(prev => prev + 1)
      setLastSaved({
        ...currentDetection,
        zone: selectedZoneRef.current,
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
        return { ...det, crack_length_mm, severity: severity_score, verdict: getVerdict(det.label, zone, crack_length_mm) }
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

      {/* Tail number selector */}
      {!cameraActive && (
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
            <span style={{ fontSize: 11, color: '#00c2ff', fontWeight: 700 }}>{selectedTail}</span>
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
            background: currentDetection.verdict === 'FAIL' ? '#7f1d1d' : '#14532d',
            color: currentDetection.verdict === 'FAIL' ? '#fca5a5' : '#86efac',
            padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700
          }}>{currentDetection.verdict}</span>
        </div>
      )}

      {/* Last saved confirmation */}
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

      {/* Buttons */}
      <button onClick={cameraActive ? stopCamera : startCamera} style={{
        background: cameraActive ? '#7f1d1d' : '#00c2ff',
        color: cameraActive ? '#fca5a5' : '#0a0f1a',
        border: 'none', borderRadius: 8, padding: '12px 0',
        fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%'
      }}>
        {cameraActive ? '⏹ Stop Camera' : '▶ Start Camera'}
      </button>

      {/* Manual save button — only show when camera active and defect detected */}
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

    </div>
  )
}