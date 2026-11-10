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
