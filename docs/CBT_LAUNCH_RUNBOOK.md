# CBT online exam — launch runbook

What to do before, during and after an online exam. Written for the person running the exam day.

## One-time setup (do once, before the first real exam)

1. **Run the SQL.** In the Supabase SQL editor run `supabase/CBT_NEW_SQL_061_to_066.sql` (needs `20261034`–`20261040` already run). It is safe to run again.
2. **Close open sign-ups.** Supabase → Authentication → Providers/Settings: turn **off** "Allow new users to sign up", or turn **on** "Confirm email". Staff access to the answer key is decided by a login-name pattern; with open sign-ups and no email confirmation, a stranger could register a staff-looking address.
3. **Backups.** Supabase → Settings → Database → Backups: confirm a daily backup exists (point-in-time recovery if your plan has it). Take a manual backup the day before an important exam.
4. **Fill in student data.** In Students, every active student who will sit online needs a **parent / guardian number**. A **date of birth**, **district** and **caste / category** are strongly recommended (date of birth is a second check; district / caste feed the analysis). The **Readiness** button (below) counts the gaps.

## Per exam

1. Build the test (CBT → Tests). Use the smart check; set the **answer key** for every question.
2. In Exam security choose what you need: shuffling, full screen (warn / strict), per-section minutes, calculator / rough work, **earliest submit**, guests (only if truly needed).
3. Publish (🌐 Online). Set an **access code** (6+ characters) and, ideally, an open / close time.
4. Open **✅ Readiness** on the exam card. Fix every red ✕. Read every amber !.
5. **Rehearse.** Open the exam link yourself on a real phone and on a computer. Use "Try the practice test" first. Start the real exam with a test student if you have one, then delete that attempt from Results.
6. Send the invitation (📋 Copy invitation / WhatsApp). Tell students to use their own GCC number and the parent / guardian number registered at admission, and to type their date of birth as DD/MM/YYYY.

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
5. Check candidates tagged **DOB added** (their date of birth was missing and they typed it) and correct any wrong dates in Students.

## If something goes wrong

| Problem | What to do |
|---|---|
| "No parent number on file" | Add the parent / guardian number in Students, then the student retries. |
| "Number or date of birth does not match" | Check the student's record in Students (number and date of birth). Wrong tries are limited to 20 per GCC number per 10 minutes. |
| "Already started" on a new device | A student can continue on the same device. If the device is lost, **Reset** that candidate in Live. |
| "Too many tries from this network" | Wait ten minutes. The limits are in `cbt_limit()` (migration 20261063); raise them if a very large batch shares one address. |
| Many students "dropped off" at once | Likely the venue's internet. Their answers are kept; they continue when it returns. Give extra time (+10 min) to those affected. |
| Exam page will not load | Check Supabase status and the project's paused / over-quota state. Have a plan B: a printed paper. |
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
