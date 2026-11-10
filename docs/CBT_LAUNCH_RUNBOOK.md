# CBT online exam — launch runbook

What to do before, during and after an online exam. Written for the person running the exam day.

## One-time setup (do once, before the first real exam)

1. **Run the SQL.** In the Supabase SQL editor run `supabase/CBT_NEW_SQL_061_to_066.sql` (needs `20261034`–`20261040` already run), then `supabase/migrations/20261114_cbt_no_dob_check.sql` (removes the date-of-birth check). Both are safe to run again.
2. **Close open sign-ups.** Supabase → Authentication → Providers/Settings: turn **off** "Allow new users to sign up", or turn **on** "Confirm email". Staff access to the answer key is decided by a login-name pattern; with open sign-ups and no email confirmation, a stranger could register a staff-looking address.
3. **Backups.** Supabase → Settings → Database → Backups: confirm a daily backup exists (point-in-time recovery if your plan has it). Take a manual backup the day before an important exam.
4. **Fill in student data.** In Students, every active student who will sit online needs a **parent / guardian number**. **District** and **caste / category** are strongly recommended (they feed the analysis). The date of birth is **not** asked for any more. The **Readiness** button (below) counts the gaps.

## Per exam

1. Build the test (CBT → Tests). Use the smart check; set the **answer key** for every question.
2. In Exam security choose what you need: shuffling, full screen (warn / strict), per-section minutes, calculator / rough work, **earliest submit**, guests (only if truly needed).
3. Publish (🌐 Online). Set an **access code** (6+ characters) and, ideally, an open / close time.
4. Open **✅ Readiness** on the exam card. Fix every red ✕. Read every amber !.
5. **Rehearse.** Open the exam link yourself on a real phone and on a computer. Use "Try the practice test" first. Start the real exam with a test student if you have one, then delete that attempt from Results.
6. Send the invitation (📋 Copy invitation / WhatsApp). Tell students to use their own GCC number and the parent / guardian number registered at admission.

## Telling the public (website notice and countdown)

- **CBT → 📣 Landing-page flash message** (the card above the tabs; the same switch is in Website → Settings → "CBT Flash Message"). **Switch ON** and every visitor sees a red banner at the top of the website and a pop-up when the site opens (once per browser session). It stays up **until you switch it OFF**.
- **Countdown:** in *Countdown to* pick a published test that has an **Opens** time. The banner and pop-up then count down ("Coming up"), change to **CBT LIVE** when the exam opens, and hide themselves after the **Closes** time. If you change that test's Opens / Closes time later (Online tab → publish again) the countdown follows. The same countdown shows on the exam page before it opens.
- The countdown uses each visitor's own clock; the exam itself always opens and closes on the **server's** time.
- The website menu, the phone bottom bar and the header carry a **CBT Exam** link to `/exam`. With no test in the link, that page asks for the exam link or Test ID. A phone that already started an exam shows **Continue as …** and **Not me · start fresh** (clears that phone only; the attempt stays on the server — use **Reset** in Live to allow a new attempt).
- **Candidates can find the current test without a link.** The `/exam` page lists **Tests open now** (and tests opening within 60 days, with a countdown) with a Start button. Run `supabase/RUN_cbt_public_list.sql` once in Supabase (SQL editor) to switch this on. It shows only the test name, length and timing — never questions, answers or the access code — and a candidate still needs the access code, GCC no. and parent number. In **Publish** untick **Show on the public exam page** for a private batch test.
- **Practising past exams.** Once an exam is **closed** and its answers are out (the same moment candidates may see the key), anyone can retake the same paper in **practice mode** from `/exam` ("Practise past exams") or from that exam's closed page. It runs in the browser only: nothing is recorded, counted or sent. Run `supabase/RUN_cbt_past_practice.sql` once in Supabase to switch it on. It needs the test to **show answers**. In **Publish**, untick **Allow practice after it closes** if you will reuse those questions (and **Show on the public exam page** off also hides it).
- The **practice test** works at any time — before, during and after an exam closes, and from the `/exam` page with no link.
- The flash message and countdown need nothing in the database beyond the existing `website_settings` table. Whoever uses the switch needs permission to edit website settings.

## What the candidate sees

Welcome screen (institute, test, questions / minutes / marks) → the instructions **one slide at a time** (message from the Founder, about the test, general instructions, marking scheme, question palette, answering and moving around, and exam rules when camera / full screen / shield are on) → declaration → camera check (if on) → the exam. Each step slides in. A candidate who reopens an exam in progress goes straight back to it.

The Founder's photo is taken from the website's Faculty photos (Website Manager → Faculty) by name, so keep a photo on that card.

## During the exam

- Keep the **🔴 Live** tab open (it refreshes every 15 seconds).
  - **In exam** — saving normally. **Dropped off** — no save for 100 seconds (lost signal, closed the page, or left). Their answers are kept and they continue when they return.
  - **+5 min / +10 min** — extra time for one candidate (power cut, technical fault on their side). **Reset** — deletes that candidate's attempt so they can start again from the beginning (use only if they truly could not continue).
- A whole room on one Wi-Fi is fine (limits are per network address and sized for a large class). If many students report "too many tries from this network", wait ten minutes — or see "If something goes wrong".
- Do not change the answer key or republish while candidates are inside.

## After the exam

1. Close the exam (⏹ Close). The answer key and review are shown to students only after it is closed **and** nobody is still inside their time (an attempt with no save for 15 minutes does not hold it back).
2. **Results** → check the integrity report (a risk level is an *indicator*, never proof), then **Export CSV**.
3. Wrong answer key? Correct it in the builder, **publish again**, then Results → **🔄 Re-evaluate scores**. The old marks are kept inside each score.
4. Open **Analysis** for question difficulty, option picks, section and district / gender / category results, and print per-student reports. Print certificates from the Certificates tool.
5. Older attempts may carry a **DOB added** tag (from before the date-of-birth check was removed); it is only a record and can be ignored.

## If something goes wrong

| Problem | What to do |
|---|---|
| "No parent number on file" | Add the parent / guardian number in Students, then the student retries. |
| "The number does not match" | Check the parent / guardian number in the student's record in Students. Wrong tries are limited to 20 per GCC number per 10 minutes. |
| "Already started" on a new device | A student can continue on the same device. If the device is lost, **Reset** that candidate in Live. |
| "Too many tries from this network" | Wait ten minutes. The limits are in `cbt_limit()` (migration 20261063); raise them if a very large batch shares one address. |
| Many students "dropped off" at once | Likely the venue's internet. Their answers are kept; they continue when it returns. Give extra time (+10 min) to those affected. |
| Exam page will not load | Check Supabase status and the project's paused / over-quota state. Have a plan B: a printed paper. |
| Flash message does not appear | Is it switched ON (CBT card)? Open the website in a private window (the pop-up shows once per session). If it says "Could not save", the account lacks permission to edit website settings. |
| Countdown is wrong or missing | The test needs an **Opens** time (Online tab → publish). Re-pick it in *Countdown to* and press Save text. |
| Result looks wrong | Answer key problem: fix → republish → Re-evaluate. |

## What this system does **not** do

- It cannot stop a determined cheater with a modified browser or a second phone. Full-screen strikes, tab-leave counts and the camera check are **indicators**. Do not promise "cheat-proof".
- Section timers and full-screen rules are enforced in the candidate's browser; the server enforces the overall clock. iPhones / iPads cannot be forced into full screen — leaving the page counts as the exit instead.
- Guest candidates (not in the ERP) are **not** verified by a one-time code. Allow guests only for exams where that is acceptable.
- It is built for one institute (its ERP students, GCC numbers and staff logins).

## Re-running the checks

```bash
node tools/cbtLoadTest.mjs --students 300 --save-every 20 --minutes 3 --ip nat   # database load test (needs a scratch Postgres)
node --test tests/*.test.js                                                      # all unit tests
```

The end-to-end candidate-flow test lives in `tools/cbt-e2e/` (see its README).
