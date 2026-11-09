// cbtProctor.js — the camera side of the exam's face check: open the camera, load the (already bundled) face-api
// models and report where the faces are. Nothing is recorded or uploaded — frames are looked at and thrown away;
// only the counts (face not visible, second person, looking away …) are kept with the attempt.
import { yawRatio } from './lib/cbtProctorLogic'

const MODEL_URL = '/models'          // public/models, shared with the staff face check-in
let loading = null

export function loadDetector() {
  if (!loading) {
    loading = import('face-api.js').then(async f => {
      await Promise.all([f.nets.tinyFaceDetector.loadFromUri(MODEL_URL), f.nets.faceLandmark68Net.loadFromUri(MODEL_URL)])
      return f
    }).catch(e => { loading = null; throw e })
  }
  return loading
}

export async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the camera. Use Chrome, Edge or Safari over https.')
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
  } catch (e) {
    const denied = /denied|notallowed|permission/i.test(`${e.name} ${e.message}`)
    throw new Error(denied ? 'Camera permission was blocked. Allow the camera for this site (the lock icon in the address bar) and try again.' : /notfound|devicesnotfound/i.test(e.name) ? 'No camera was found on this device.' : `The camera could not be opened (${e.message || e.name}).`, { cause: e })
  }
}

// → [{ w, ratio }] for every face in the frame
export async function detectFaces(f, video) {
  const found = await f.detectAllFaces(video, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })).withFaceLandmarks()
  return found.map(r => ({ w: r.detection.box.width, ratio: yawRatio(r.landmarks.positions) }))
}
