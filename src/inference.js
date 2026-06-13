import * as ort from 'onnxruntime-web'

let session = null

export async function loadModel() {
  if (session) return session
  try {
    session = await ort.InferenceSession.create('/model/Drishti.onnx', {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all'
    })
    console.log('✅ ONNX model loaded')
    return session
  } catch (err) {
    console.error('❌ Failed to load ONNX model:', err)
    return null
  }
}

export async function runInference(videoElement) {
  if (!session) {
    session = await loadModel()
    if (!session) return []
  }

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0, 640, 640)

  const imageData = ctx.getImageData(0, 0, 640, 640)
  const { data } = imageData

  // convert to float32 RGB tensor [1, 3, 640, 640]
  const float32 = new Float32Array(1 * 3 * 640 * 640)
  for (let i = 0; i < 640 * 640; i++) {
    float32[i] = data[i * 4] / 255.0           // R
    float32[i + 640 * 640] = data[i * 4 + 1] / 255.0  // G
    float32[i + 640 * 640 * 2] = data[i * 4 + 2] / 255.0 // B
  }

  const tensor = new ort.Tensor('float32', float32, [1, 3, 640, 640])
  const feeds = { images: tensor }

  const results = await session.run(feeds)

  // YOLOv8 output: [1, 9, 8400]
  // 9 = x, y, w, h + 5 class scores
  const output = results[Object.keys(results)[0]].data
  const numDetections = 8400
  const numFields = output.length / numDetections

  const CLASSES = ['crack', 'corrosion', 'dent', 'paint_blister', 'delamination']
  const CONF_THRESHOLD = 0.4
  const detections = []

  for (let i = 0; i < numDetections; i++) {
    // get class scores
    let maxScore = 0
    let maxClass = 0
    for (let c = 0; c < CLASSES.length; c++) {
      const score = output[(4 + c) * numDetections + i]
      if (score > maxScore) {
        maxScore = score
        maxClass = c
      }
    }

    if (maxScore < CONF_THRESHOLD) continue

    // get box — YOLOv8 outputs cx, cy, w, h normalised to 640
    const cx = output[0 * numDetections + i]
    const cy = output[1 * numDetections + i]
    const w  = output[2 * numDetections + i]
    const h  = output[3 * numDetections + i]

    // convert to x, y, w, h in video pixel space
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
}