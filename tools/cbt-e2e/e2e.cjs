// End-to-end test of the candidate page against the real SQL. See tools/cbt-e2e/README.md.
const { chromium, devices } = require('playwright')
const path = require('path')
const os = require('os')
const URL = 'file://' + path.join(os.tmpdir(), 'cbt-e2e', 'e2e.html') + '?t=e2e1'
const results = []
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra || '']); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')) }

async function fillIdentity(p, gcc, phone, dob) {
  await p.getByLabel('Access code *').fill('246810')
  await p.getByPlaceholder('your GCC number').fill(gcc)
  await p.waitForSelector('text=GCC no. found', { timeout: 8000 })
  await p.getByRole('button', { name: /^Next/ }).click()
  await p.getByPlaceholder('10-digit mobile').fill(phone)
  if (dob !== null) await p.getByPlaceholder('DD/MM/YYYY').fill(dob)
  await p.getByRole('button', { name: /Verify and continue/ }).click()
}
// The exam opens on a welcome screen, then the instructions one slide at a time, then the declaration.
async function passInstructions(p) {
  await p.getByRole('button', { name: /Read the instructions/ }).click()
  for (let i = 0; i < 12; i++) {
    const done = p.getByRole('button', { name: /Continue to declaration/ })
    if (await done.count()) { await done.click(); return }
    await p.getByRole('button', { name: /^Next/ }).click()
  }
  throw new Error('never reached the declaration')
}
async function beginExam(p) {
  await passInstructions(p)
  await p.locator('input[type=checkbox]').first().check()
  await p.getByText('I am ready to begin').click()
  await p.waitForSelector('label.cbt-opt', { timeout: 8000 })
}
async function takeExam(p, phone) {
  await passInstructions(p)
  await p.locator('input[type=checkbox]').first().check()
  await p.getByText('I am ready to begin').click()
  await p.waitForSelector('label.cbt-opt', { timeout: 8000 })
  const answer = { 'What is 2 + 2?': '4', 'What is 3 x 3?': '9', 'What is 10 - 4?': '6' }
  const seen = []
  for (let i = 0; i < 3; i++) {
    const text = (await p.locator('.cbt-qtext, .cbt-q, .cbt-main').first().innerText())
    const q = Object.keys(answer).find(k => text.includes(k)); seen.push(q)
    await p.locator('label.cbt-opt', { hasText: new RegExp('^\\s*[A-D]\\.\\s*' + answer[q] + '\\s*$') }).first().click()
    await p.getByText('Save & Next').click(); await p.waitForTimeout(250)
  }
  if (phone) { await p.locator('button[aria-label="Open question palette"]').click(); await p.waitForTimeout(250) }
  await p.getByRole('button', { name: /Submit Test/ }).first().click(); await p.waitForTimeout(300)
  for (let i = 0; i < 3; i++) { const b = p.locator('.cbt-modal button', { hasText: /^(Yes|Submit|Confirm)/i }).last(); if (await b.count()) { await b.click(); await p.waitForTimeout(600) } }
  return seen
}

;(async () => {
  const b = await chromium.launch()
  const mk = async (device) => { const ctx = await b.newContext(device ? { ...devices['iPhone 13'] } : { viewport: { width: 1200, height: 800 } }); const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message)); return [ctx, p] }

  // A. a student with a date of birth on file, on an iPhone-sized screen
  let [ctx, p] = await mk(true)
  await p.goto(URL); await p.waitForSelector('text=E2E Mock Test')
  ok('A1 landing page shows the exam', true)
  await fillIdentity(p, '1', '9600000001', '04/03/2011')
  const seen = await takeExam(p, true)
  ok('A2 the three questions were all shown (shuffled order differs per attempt)', new Set(seen).size === 3, seen.join(' | '))
  await p.waitForSelector('text=Test submitted', { timeout: 8000 }).catch(() => {})
  const body = await p.locator('body').innerText()
  ok('A3 result screen shows 3 / 3 from the server score', /3\s*\/\s*3/.test(body), (body.match(/Score[\s\S]{0,30}/) || [''])[0].replace(/\s+/g, ' '))
  await p.screenshot({ path: path.join(os.tmpdir(), 'cbt-e2e', 'phone-result.png'), fullPage: true }); await ctx.close()

  // B. wrong date of birth is refused
  ;[ctx, p] = await mk(false)
  await p.goto(URL); await p.waitForSelector('text=E2E Mock Test')
  await p.getByLabel('Access code *').fill('246810'); await p.getByPlaceholder('your GCC number').fill('1')
  await p.waitForSelector('text=GCC no. found'); await p.getByRole('button', { name: /^Next/ }).click()
  await p.getByPlaceholder('10-digit mobile').fill('9600000001'); await p.getByPlaceholder('DD/MM/YYYY').fill('01/01/2011')
  await p.getByRole('button', { name: /Verify and continue/ }).click(); await p.waitForTimeout(800)
  const t = await p.locator('body').innerText()
  ok('B1 wrong date of birth is refused and no exam starts', /does not match/i.test(t) && !(await p.locator('label.cbt-opt').count()))
  await ctx.close()

  // C. a student with NO date of birth on file is asked for one, and it is saved
  ;[ctx, p] = await mk(false)
  await p.goto(URL); await p.waitForSelector('text=E2E Mock Test')
  await p.getByLabel('Access code *').fill('246810'); await p.getByPlaceholder('your GCC number').fill('2')
  await p.waitForSelector('text=GCC no. found'); await p.getByRole('button', { name: /^Next/ }).click()
  const label = await p.locator('body').innerText()
  ok('C1 the page says the date of birth is missing and asks for it', /not in our records yet/i.test(label))
  await p.getByPlaceholder('10-digit mobile').fill('9600000002'); await p.getByPlaceholder('DD/MM/YYYY').fill('12/08/2012')
  await p.getByRole('button', { name: /Verify and continue/ }).click()
  await p.getByRole('button', { name: /Read the instructions/ }).waitFor({ timeout: 8000 })   // the welcome screen
  ok('C2 verified and moved on to the welcome screen', true)
  await beginExam(p)
  ok('C3 the exam started for the student whose date of birth was missing', true)
  await ctx.close()

  // D. a guest
  ;[ctx, p] = await mk(false)
  await p.goto(URL); await p.waitForSelector('text=E2E Mock Test')
  await p.getByLabel('Access code *').fill('246810'); await p.getByPlaceholder('your GCC number').fill('1')
  await p.getByRole('button', { name: /Take the exam as a guest/ }).click()
  await p.getByLabel('Full name *').fill('Guest Person'); await p.getByPlaceholder('10-digit mobile').fill('9811122233')
  await p.getByLabel('District *').selectOption('Thoubal'); await p.getByLabel('Gender *').selectOption('Male'); await p.getByLabel('Category (caste) *').selectOption('OBC')
  await p.getByRole('button', { name: /^Continue/ }).click()
  await p.getByRole('button', { name: /Read the instructions/ }).waitFor({ timeout: 8000 })   // the welcome screen
  ok('D1 a guest with district / gender / category gets to the welcome screen', true)
  await beginExam(p)
  ok('D2 the guest exam started', true)
  await ctx.close()
  // E. the question order differs between candidates (shuffle works end to end)
  const firsts = []
  for (const g of ['3', '4', '5', '6', '7', '8']) {
    ;[ctx, p] = await mk(false)
    await p.goto(URL); await p.waitForSelector('text=E2E Mock Test')
    await fillIdentity(p, g, '96000000' + String(10 + Number(g)), '04/03/2011')
    await beginExam(p)
    const txt = await p.locator('.cbt-main').first().innerText()
    const q = ['2 + 2', '3 x 3', '10 - 4'].find(k => txt.includes(k)); const opts = (await p.locator('label.cbt-opt').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim()).join('|')
    firsts.push(q + ' / ' + opts); await ctx.close()
  }
  ok('E1 question and option order differ between six candidates', new Set(firsts).size > 1, new Set(firsts).size + ' different of 6')
  await b.close()
  process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0)
})().catch(e => { console.error('SCRIPT ERROR', e.message.split('\n')[0]); process.exit(2) })
