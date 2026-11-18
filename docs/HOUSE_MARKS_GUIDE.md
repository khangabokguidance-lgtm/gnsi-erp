# GNSI Portal · Hostel → 📝 Marks — Staff & Admin Guide

## One-time setup (admin)
1. Supabase → SQL Editor → paste `supabase/RUN_house_test_marks.sql` → Run. Safe to run again.
2. Check that row-level security is off for the four tables (the file does this):
   `select relname, relrowsecurity from pg_class where relname like 'house_test_%';` → every row `false`.
3. Reload the portal (Ctrl+F5).

## Housemaster: enter marks in 4 steps
1. **Test details** — choose the test type:
   - 📘 *Navodaya booklet chapter*: tap one of the 9 chapters (or the Day 10 full mock). Chapter is compulsory. Out of 50 (mock: 25, pass 7).
   - 🪖 *Sainik section*: Language 50, Mathematics 150, Intelligence 50, General Knowledge 50, or the full 300 paper. Section is compulsory. Extra subjects can be added.
   - 📝 *Any subject*: free name, any subjects, Test 1–9 buttons, saved templates.
   Then type the **Name of the group** (compulsory) and the date.
2. **My class** — search the school list and tap ＋ Add (or ＋ Add all for a class). Nothing is added automatically. A new test opens with your last group and its students.
3. **Enter marks** — type each mark; `AB` = absent. Red cell = impossible mark, amber = below the pass mark.
4. **Save test** — all housemasters share one test; saving only adds *your* students, nobody else's marks are touched. Export PDF / Excel / Share any time.

## Everyone: other tabs
- **📚 Past results & analysis** — every saved test, ranking, teachers, groups, classes, subjects, grade spread, student history, PDF/Excel.
- **👥 Group list** — every housemaster's groups and students; ⚠ marks a student who is in two housemasters' lists.

## Admin only
- **🏠 Dashboard** — all houses compared (average, pass %, coverage, topper), top 10 students, housemaster activity, Excel.
- **Edit anything** — open a test from the Dashboard or Past results: every housemaster's students load and any mark can be changed; the student stays recorded under the original housemaster.
- **Delete** — a whole test (Dashboard, Past results, or inside the test), any group, any student in a group.

## Rules the system applies
- Rank uses the total of students with **every** subject filled (or `AB`). Ties share a rank.
- Grade from %: A+ ≥90, A ≥80, B+ ≥70, B ≥60, C ≥50, D ≥40, E below.
- Pass: no mark below its minimum (absent in a subject that has a minimum = not passed); with no minimum set, 40%.
- Unsaved marks are kept as a draft on that device and the browser warns before closing.

## Known limits
- Access control is in the portal screens only. The database tables are open to anyone with the portal's public key (row-level security is off, like the other portal tables). Real per-user protection needs Supabase Auth, which the portal does not use today.
- A housemaster's class and last group are tied to the login *name*; two staff with the same login name share a class.
- A student in two housemasters' classes shows blank to the second one; whoever saves last wins for that student.
- Past results and the Dashboard read the latest 300 tests.
