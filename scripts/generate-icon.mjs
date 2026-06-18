import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)

  // scale factor
  const s = size / 192

  // rocket body
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(size / 2, size * 0.45, 22 * s, 38 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // rocket tip
  ctx.beginPath()
  ctx.moveTo(size / 2, size * 0.12)
  ctx.lineTo(size / 2 - 22 * s, size * 0.45)
  ctx.lineTo(size / 2 + 22 * s, size * 0.45)
  ctx.closePath()
  ctx.fill()

  // rocket window
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.arc(size / 2, size * 0.42, 10 * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.arc(size / 2, size * 0.42, 10 * s, 0, Math.PI * 2)
  ctx.stroke()

  // left fin
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(size / 2 - 22 * s, size * 0.68)
  ctx.lineTo(size / 2 - 42 * s, size * 0.82)
  ctx.lineTo(size / 2 - 22 * s, size * 0.78)
  ctx.closePath()
  ctx.fill()

  // right fin
  ctx.beginPath()
  ctx.moveTo(size / 2 + 22 * s, size * 0.68)
  ctx.lineTo(size / 2 + 42 * s, size * 0.82)
  ctx.lineTo(size / 2 + 22 * s, size * 0.78)
  ctx.closePath()
  ctx.fill()

  // flame
  ctx.fillStyle = '#00c2ff'
  ctx.beginPath()
  ctx.moveTo(size / 2 - 12 * s, size * 0.82)
  ctx.lineTo(size / 2, size * 0.96)
  ctx.lineTo(size / 2 + 12 * s, size * 0.82)
  ctx.closePath()
  ctx.fill()

  return canvas.toBuffer('image/png')
}

writeFileSync('public/icon-192.png', generateIcon(192))
writeFileSync('public/icon-512.png', generateIcon(512))
console.log('Icons generated successfully')