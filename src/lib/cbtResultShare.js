// cbtResultShare.js — the "send my result on WhatsApp" message for a mock / practice test. Pure.
// wa.me opens WhatsApp with the message already typed; the student taps Send (WhatsApp does not allow a page to send by itself).

/** Where mock / practice results are sent: country code 91 + the 10-digit number, digits only (wa.me format). */
export const RESULT_WA_NUMBER = '918974298074'

const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** The message: test, GCC no., score, counts, time and the marks of each section. */
export function resultMessage({ testName, gcc, g, tookMin, label = 'Practice' }) {
  const lines = [
    `*GNSI ${label} result*`,
    `Test: ${testName}`,
    gcc ? `GCC no.: ${gcc}` : '',
    `Score: ${n(g.marks)} / ${n(g.max)}${g.max ? ` (${n(g.percent)}%)` : ''}`,
    `Correct ${n(g.correct)} · Wrong ${n(g.wrong)} · Not answered ${n(g.skipped)}`,
    tookMin ? `Time taken: ${tookMin} min` : '',
    ...((g.sections || []).length > 1 ? ['', ...g.sections.map(s => `${s.label ? `${s.label} ` : ''}${s.title}: ${n(s.marks)}/${n(s.max)}`)] : []),
  ]
  return lines.filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n')
}

export const waLink = (to, text) => `https://wa.me/${String(to).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
