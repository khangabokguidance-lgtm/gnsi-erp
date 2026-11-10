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
      // the second, more accurate model is a bonus: if it cannot be loaded the fast one still does the whole job
      const ssd = await f.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).then(() => true).catch(() => false)
      return { api: f, ssd }        // the library is an ES module (read-only), so the detector is a small object around it
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

const boxOf = b => ({ x: b.x, y: b.y, w: b.width, h: b.height })
// → [{ w, ratio, box }] for every face in the frame (w is in the video's own pixels; compare with video.videoWidth)
export async function detectFaces(det, video) {
  const f = det.api
  const found = await f.detectAllFaces(video, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })).withFaceLandmarks()
  return found.map(r => ({ w: r.detection.box.width, ratio: yawRatio(r.landmarks.positions), box: boxOf(r.detection.box) }))
}
// The second look (every few frames): SSD MobileNet when it is loaded, otherwise the fast model again at a larger size and a lower bar.
// → [{ w, box }]
export async function scanMoreFaces(det, video) {
  const f = det.api
  const opts = det.ssd ? new f.SsdMobilenetv1Options({ minConfidence: 0.55, maxResults: 8 }) : new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
  const found = await f.detectAllFaces(video, opts)
  return found.map(r => ({ w: r.box.width, box: boxOf(r.box) }))
}
