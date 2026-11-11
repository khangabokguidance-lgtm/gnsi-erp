# Static mock tests (no database load)

A static mock is one JSON file under `public/mocks/`, served by the CDN. The exam page runs it **entirely in the
student's browser** — timer, camera / tab rules and marking — so any number of students add **no exam traffic** — no login, no autosave, no polling. (The site still makes its normal page-start calls for settings, like every page.)

## Publish one
1. CBT → Online → open a test's Publish window → **⬇ Static mock file** (every question must have an answer key).
2. In the repo: `node scripts/add-mock.mjs <slug>.json` — copies it to `public/mocks/` and updates `index.json`.
3. Commit and deploy. Link: `https://<site>/exam?mock=<slug>`; it also appears under **Mock tests** on the exam page.
4. Remove one: `node scripts/add-mock.mjs --remove <slug>`.

## What it does and does not do
- Student sees their own score and the answers at the end (per the test's show-result / show-answers settings).
- **Nothing is recorded about a student** — no Result out board, no Top 5, no flags reach staff. A refresh restarts the mock.
- **Two counters only (👁 views · students appeared):** run `supabase/RUN_cbt_mock_stats.sql` once. Each device sends at most one view per day and one "appeared" per mock — two tiny writes, no names, no answers. The numbers show on the mock's page and its card on the exam page. Without the SQL the mock works the same and the numbers simply do not show.
- **The answer key is inside the file**, so a determined student can read it. Use for practice / pre-mocks, never the official exam.
- Camera and tab-switch rules run as authored in the test, but only the student sees them.

## Let 300+ students practise a past exam with no database
Add the closed exam as a static mock (steps above). Its file keeps the exam's id, so on the exam page the existing
**Practise →** button for that exam automatically loads the CDN copy instead of asking the database. The exam is not
listed twice. Remove the file (`--remove`) to go back to the database copy.

## One-click practice copy (no files, no deploy)
Run `supabase/RUN_cbt_practice_bucket.sql` once in the Supabase SQL editor (creates the public bucket `cbt-practice`; only staff can write).
After an exam has **closed**: CBT → Tests → 🌐 Online → **🚀 Publish practice copy**. The exam page's **Practise →** button then
loads it from the CDN at once. **🗑 Remove practice copy** takes it down. Needs the paper to be on this computer and every question keyed.
Copies from this bucket are tried first, then ones committed under `public/mocks/`.

## Automatic practice copy (no database load per student)
When a student presses **Practise →** on a past exam that has no CDN copy yet, the page asks the site (`/api/entrance?action=practice-copy`) to make one.
The server reads the paper **once**, saves it to the `cbt-practice` bucket and adds it to `index.json`; that student and everyone after read the CDN.
- The database still decides whether practice is allowed (closed, listed, answers out, practice on). If not, nothing is published.
- Run `supabase/RUN_cbt_practice_bucket.sql` once (the bucket) and, to be safe, `supabase/RUN_cbt_practice_auto_copy.sql`.
- If anything fails (no bucket, server problem), the page falls back to the database copy exactly as before.
- A copy you **Remove** stays removed only while its entry is gone from the list: the next student's Practise would make it again. To stop practice for an exam, switch its practice option off instead.
- No deadline is set on automatic copies. Publish one yourself with an end date if you want one.

## Practice deadline
When you publish a practice copy, **Practice copy ends on** is prefilled to a week ahead (clear it for no deadline). Until then the
exam shows "⏳ ends in 2 days 4 h" in the banner and the practice list. After it, the exam leaves the practice list and its
Practise button refuses. It is a soft limit: the file stays on the CDN until you press **Remove practice copy**, so remove it
too if the answers must really disappear. To change a deadline, remove the copy and publish it again.

## GCC no. and 3 tries per test
Run `supabase/RUN_cbt_mock_practice_gcc.sql` once. Before a mock or a past-exam practice starts, the page asks for the student's GCC no.
The database checks it is an active student and allows **3 starts per GCC per test**, then says "You have already practised this test 3 times".
Staff see **👤 Who practised (by GCC no.)** at the bottom of CBT → Online (search, CSV; an admin can **Reset** a student's tries).
- It stores only the GCC no., the test and the time — about 100 bytes a start, so even 100,000 starts is only a few MB.
- A try is counted when the student presses Continue, even if the page is then refreshed (a mock does not save progress).
- It is a soft limit: the mock file itself is public, and anyone who knows another student's GCC no. could use up their tries. Staff can Reset.
- Without the SQL, or when the network fails, practice works exactly as before and nothing is asked or counted.
- To change 3, edit `lim` in the SQL file and run it again (the staff list shows "/3" in `CbtPracticeLog.jsx`).
