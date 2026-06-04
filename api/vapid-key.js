// api/vapid-key.js
// Returns the VAPID public key to the frontend
export default function handler(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
}