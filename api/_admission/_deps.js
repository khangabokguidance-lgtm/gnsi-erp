// Re-exports from the entrance helpers so the admission handlers have one import point.
export { db, send, only, body, BUCKET } from '../_entrance/_lib.js'
export { sameDob as sameDobFn } from '../_entrance/entranceReg.js'
