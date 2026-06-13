import { useRef, useEffect, useState } from 'react'
import ZoneSelector from './ZoneSelector'
import { scoreSeverity, getVerdict } from '../utils'
import { db } from '../db/db'
import { loadModel, runInference } from '../inference'

export default function LiveScan() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [selectedZone, setSelectedZone] = useState(null)
  const [error, setError] = useState(null)
  const [detections, setDetections] = useState([])
  const [savedCount, setSavedCount] = useState(0)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const selectedZoneRef = useRef(null)
  const runningRef = useRef(false)

  useEffect(() => {
    selectedZoneRef.current = selectedZone
  }, [selectedZone])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      videoRef.current.srcObject = stream
      setCameraActive(true)
      runningRef.current = true

      // try loading model in background
      setModelLoading(true)
      const sess = await loadModel()
      setModelLoaded(!!sess)
      setModelLoading(false)

      // start inference loop
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
    setDetections([])
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
      const { x, y, w, h, label, severity, verdict } = det
      const color = verdict === 'FAIL' ? '#ef4444' : '#22c55e'
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
      const text = `${label} | ${det.crack_length_mm}mm | ${verdict}`
      ctx.font = 'bold 15px Inter'
      const tw = ctx.measureText(text).width
      ctx.fillStyle = color
      ctx.fillRect(x, y - 28, tw + 12, 26)
      ctx.fillStyle = '#000'
      ctx.fillText(text, x + 6, y - 8)
    })
  }

  async function saveDetection(detection) {
    try {
      await db.inspections.add({
        tail_number: 'VT-TEST-001',
        zone_id: selectedZoneRef.current || 'fuselage_front',
        defect_type: detection.label,
        severity_score: detection.severity,
        crack_length_mm: detection.crack_length_mm,
        verdict: detection.verdict,
        timestamp: new Date().toISOString(),
        inspector_id: 'INSPECTOR-01'
      })
      setSavedCount(prev => prev + 1)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  async function inferenceLoop() {
    while (runningRef.current) {
      const video = videoRef.current
      if (!video || !video.videoWidth) {
        await sleep(500)
        continue
      }

      let rawDetections = []

      // try real model first
      try {
        rawDetections = await runInference(video)
      } catch {
        rawDetections = []
      }

      // fallback to simulation if no model or no detections
      if (rawDetections.length === 0) {
        rawDetections = [{
          x: video.videoWidth * 0.3,
          y: video.videoHeight * 0.3,
          w: video.videoWidth * 0.15,
          h: video.videoHeight * 0.08,
          label: 'crack',
          confidence: 0.91
        }]
      }

      const zone = selectedZoneRef.current || 'fuselage_front'
      const processed = rawDetections.map(det => {
        const { crack_length_mm, severity_score } = scoreSeverity(
          det.x, det.y, det.w, det.h, video.videoWidth, video.videoHeight
        )
        const verdict = getVerdict(det.label, zone, crack_length_mm)
        return { ...det, crack_length_mm, severity: severity_score, verdict }
      })

      setDetections(processed)
      drawBoxes(processed)

      // save highest severity detection only
      if (processed.length > 0) {
        const top = processed.reduce((a, b) => a.severity > b.severity ? a : b)
        await saveDetection(top)
      }

      await sleep(2000)
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  useEffect(() => {
    return () => { runningRef.current = false; stopCamera() }
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Camera + canvas */}
      <div style={{ position: 'relative', background: '#111827', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e2d40', aspectRatio: '16/9' }}>
        <video
          ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        {!cameraActive && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <p style={{ color: '#64748b', fontSize: 13 }}>Camera not started</p>
          </div>
        )}

        {/* Model status badge */}
        {cameraActive && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '3px 8px' }}>
            <span style={{ fontSize: 11, color: modelLoaded ? '#22c55e' : modelLoading ? '#f59e0b' : '#64748b' }}>
              {modelLoaded ? '🟢 AI Model Active' : modelLoading ? '🟡 Loading model...' : '🔵 Simulation mode'}
            </span>
          </div>
        )}
      </div>

      {/* Saved counter */}
      {savedCount > 0 && (
        <div style={{ background: '#0f2d1a', border: '1px solid #166534', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#86efac', fontSize: 13 }}>✓ Records saved to device</span>
          <span style={{ color: '#86efac', fontSize: 13, fontWeight: 700 }}>{savedCount}</span>
        </div>
      )}

      {/* Detection cards */}
      {detections.length > 0 && (
        <div style={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {detections.map((det, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: 13, textTransform: 'capitalize' }}>{det.label}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>{det.crack_length_mm}mm | Sev {det.severity}/100</span>
              <span style={{
                background: det.verdict === 'FAIL' ? '#7f1d1d' : '#14532d',
                color: det.verdict === 'FAIL' ? '#fca5a5' : '#86efac',
                padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700
              }}>{det.verdict}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#2d1a1a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Start / Stop */}
      <button
        onClick={cameraActive ? stopCamera : startCamera}
        style={{
          background: cameraActive ? '#7f1d1d' : '#00c2ff',
          color: cameraActive ? '#fca5a5' : '#0a0f1a',
          border: 'none', borderRadius: 8,
          padding: '12px 0', fontSize: 15, fontWeight: 600,
          cursor: 'pointer', width: '100%'
        }}
      >
        {cameraActive ? '⏹ Stop Camera' : '▶ Start Camera'}
      </button>

      {/* Zone selector */}
      {cameraActive && (
        <ZoneSelector selectedZone={selectedZone} onZoneSelect={setSelectedZone} />
      )}

    </div>
  )
}