// faceEngine.js — shared face-api.js loader, descriptor extraction, matching
// Used by FaceEnroll.jsx (enrollment) and FaceCapture.jsx (check-in verification)

import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'          // served from public/models — see README
export const MATCH_THRESHOLD = 0.5   // euclidean distance; lower = stricter. Tune after pilot testing.
export const WEAK_MATCH_THRESHOLD = 0.5 // mirrors server_checkin's weak_face_match flag cutoff

let modelsLoaded = false
let loadingPromise = null

export function loadFaceModels() {
  if (modelsLoaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  loadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => { modelsLoaded = true })
  return loadingPromise
}

export function areModelsLoaded() {
  return modelsLoaded
}

// Extracts a 128-length descriptor from a single video frame or image element.
// Returns null if no face (or more than one face) was confidently detected.
export async function extractDescriptor(mediaEl) {
  const detection = await faceapi
    .detectSingleFace(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!detection) return null
  return Array.from(detection.descriptor)
}

// Averages multiple descriptors captured during enrollment into one reference vector.
export function averageDescriptors(descriptors) {
  const len = descriptors[0].length
  const avg = new Array(len).fill(0)
  for (const d of descriptors) {
    for (let i = 0; i < len; i++) avg[i] += d[i]
  }
  return avg.map(v => v / descriptors.length)
}

export function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

// Returns { verified, score } — score is the raw distance (lower = better match)
export function matchDescriptor(liveDescriptor, storedDescriptor) {
  const score = euclideanDistance(liveDescriptor, storedDescriptor)
  return { verified: score <= MATCH_THRESHOLD, score: parseFloat(score.toFixed(4)) }
}
