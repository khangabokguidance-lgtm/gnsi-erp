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
- **Nothing is recorded** — no Result out board, no Top 5, no flags reach staff. A refresh restarts the mock.
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

## Practice deadline
When you publish a practice copy, **Practice copy ends on** is prefilled to a week ahead (clear it for no deadline). Until then the
exam shows "⏳ ends in 2 days 4 h" in the banner and the practice list. After it, the exam leaves the practice list and its
Practise button refuses. It is a soft limit: the file stays on the CDN until you press **Remove practice copy**, so remove it
too if the answers must really disappear. To change a deadline, remove the copy and publish it again.
