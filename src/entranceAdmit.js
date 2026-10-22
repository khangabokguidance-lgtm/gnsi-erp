// entranceAdmit.js — open the printable admit card (or the registration confirmation slip) for one candidate.
import QRCode from 'qrcode'
import { printWindow, openPrint, admitCardHtml } from './entrancePrint'
import { hallTicketNo } from './lib/entranceNumbers'

// Call straight from a click handler: the print window is opened first (so pop-up blockers allow it), then filled
// once the QR code is ready.
export async function printAdmitCard({ candidate, exam, photo, signature, slip = false }) {
  const win = printWindow(slip ? 'registration slip' : 'admit card')
  const text = slip ? `GNSI-APP:${candidate.application_no}` : hallTicketNo(exam.id, candidate.roll_number)
  const qr = await QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: 'M' }).catch(() => '')
  openPrint(`${slip ? 'Registration slip' : 'Admit card'} · ${candidate.application_no}`, admitCardHtml(candidate, exam, { photo, signature, qr, slip }), '', win)
}
