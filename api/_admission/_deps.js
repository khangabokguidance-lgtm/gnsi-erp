// Re-exports from the entrance helpers so the admission handlers have one import point.
export { db, send, only, body, BUCKET, payFetch, razorpayOrder } from '../_entrance/_lib.js'
export { sameDob as sameDobFn } from '../_entrance/entranceReg.js'
