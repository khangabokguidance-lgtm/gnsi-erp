# CBT end-to-end test

Drives the **real candidate page** (`src/CbtPublic.jsx` and the exam screen) in a headless browser against the **real CBT SQL** on a scratch Postgres. It checks: landing, identity (GCC + parent number + date of birth), a wrong date of birth being refused, a student with no date of birth being asked for one (and it being saved), a guest registration with district / gender / category, a full exam on an iPhone-sized screen with the server's score on the result screen, and that question / option order differs between candidates.

Use a **scratch** database — never your Supabase project.

```bash
npm i --no-save pg playwright esbuild   # once; Playwright needs a Chromium (npx playwright install chromium)

# 1. a scratch Postgres with the roles, a students table (GCC 1..8 at least) and every CBT migration
#    (20261034 ... 20261066 in order, or the 034-040 files then supabase/CBT_NEW_SQL_061_to_066.sql)
# 2. seed the test exam and students
psql "$PGURL" -f tools/cbt-e2e/seed.sql

# 3. start the stand-in for Supabase RPC (leave it running), build the page, run the test
PGURL=postgres://user@127.0.0.1:5432/scratch node tools/cbt-e2e/shim.cjs &
node tools/cbt-e2e/build.cjs
node tools/cbt-e2e/e2e.cjs             # prints PASS / FAIL per step; exit code 1 on any FAIL
```

The students table needs the columns the CBT reads (`name, gcc_no, status, batch, parent_phone, father_phone, mother_phone, father_name, dob, gender`); `seed.sql` sets the parent numbers, dates of birth and genders the test uses.
