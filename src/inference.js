import * as ort from 'onnxruntime-web'

let session = null
const MODEL_TIMEOUT_MS = 60000 // 30 seconds — if not loaded, fall back to simulation

export async function loadModel() {
  if (session) return session
  try {
    // force WASM only — more reliable on mobile than WebGL
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true

    const loadPromise = ort.InferenceSession.create('/model/Drishti.onnx', {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    })

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Model load timeout')), MODEL_TIMEOUT_MS)
    )

    session = await Promise.race([loadPromise, timeoutPromise])
    console.log('✅ ONNX model loaded')
    return session
  } catch (err) {
    console.warn('⚠️ Model load failed or timed out — using simulation mode:', err.message)
    return null
  }
}

export async function runInference(videoElement) {
  if (!session) return []

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 416
    canvas.height = 416
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoElement, 0, 0, 416, 416)

    const imageData = ctx.getImageData(0, 0, 416, 416)
    const { data } = imageData

    const float32 = new Float32Array(1 * 3 * 416 * 416)
    for (let i = 0; i < 416 * 416; i++) {
      float32[i] = data[i * 4] / 255.0
      float32[i + 416 * 416] = data[i * 4 + 1] / 255.0
      float32[i + 416 * 416 * 2] = data[i * 4 + 2] / 255.0
    }

    const tensor = new ort.Tensor('float32', float32, [1, 3, 416, 416])
    const feeds = { images: tensor }
    const results = await session.run(feeds)

    const output = results[Object.keys(results)[0]].data
    const numDetections = 5460
    const CLASSES = ['crack', 'corrosion', 'dent', 'paint_blister', 'delamination']
    const CONF_THRESHOLD = 0.4
    const detections = []

    for (let i = 0; i < numDetections; i++) {
      let maxScore = 0
      let maxClass = 0
      for (let c = 0; c < CLASSES.length; c++) {
        const score = output[(4 + c) * numDetections + i]
        if (score > maxScore) { maxScore = score; maxClass = c }
      }

      if (maxScore < CONF_THRESHOLD) continue

      const cx = output[0 * numDetections + i]
      const cy = output[1 * numDetections + i]
      const w = output[2 * numDetections + i]
      const h = output[3 * numDetections + i]
      const vidW = videoElement.videoWidth
      const vidH = videoElement.videoHeight
      const scaleX = vidW / 640
      const scaleY = vidH / 640

      detections.push({
        x: (cx - w / 2) * scaleX,
        y: (cy - h / 2) * scaleY,
        w: w * scaleX,
        h: h * scaleY,
        label: CLASSES[maxClass],
        confidence: maxScore
      })
    }

    return detections
  } catch (err) {
    console.warn('Inference error:', err.message)
    return []
  }
}