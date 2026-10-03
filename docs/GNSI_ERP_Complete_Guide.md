# GNSI ERP — Complete User Guide

_Guidance Navodaya & Sainik Institute · School & Hostel Management Portal_

Generated from the app's built-in guides — 03 October 2026

## Contents

- Part 1 — Getting started
- Part 2 — Words and rules you will meet
- Part 3 — Daily, weekly and yearly routines
- Part 4 — Module guides
  - Core: Dashboard, Students, Admissions, Bulk Admission, Sessions, Admission Sessions
  - Finance: Fees, Accounts, Student Fee Ledger, Fee Setup, Construction & Maintenance
  - Academic: Attendance, Exams, Timetable, Teaching, Courses, Learning Hub, Study Lockers
  - People & Hostel: Kitchen, Staff, HR, Leave, Hostel, Awards, Face Attendance
  - Operations: Reception, Notice, Social, Connect, Website Manager, Store
  - Management & Administration: Reports, Checklist, Invitation, Certificates, Admin, Student 360°, System, Link Staff
  - Help: Help & Training
- Appendix A — When something goes wrong
- Appendix B — New staff first-week checklist

## Part 1 — Getting started

### What the GNSI ERP is

The GNSI ERP is the institute's single portal for running the school and hostel: student records and admissions, fee collection and accounts, attendance, exams and teaching, hostel roll calls and discipline, staff, leave, the kitchen and store, notices, the website and reports.

Everything is linked by the student's GCC number, so a payment, an attendance mark or a hostel entry made in one module appears wherever that student is looked up.

### Signing in

1. Open the portal and press the sign-in button. Type your Username and Password.
2. Tick "Remember me" on your own device if you want the username filled in next time. Do not do this on a shared computer.
3. Press Sign in. You land on your Dashboard.
4. Forgot your password? The sign-in page says: contact the admin. Staff cannot reset their own password.

> You stay signed in for at most 24 hours. The admin can also set an inactivity logout (System → session timeout); if it is on you will see "You were logged out after N minutes without activity."

### Finding your way around

- The left sidebar lists the modules you are allowed to open, grouped as Core, Finance, Academic, People, Operations, Management and Help. A module you cannot see is simply not allowed for your role.
- The sidebar search box ("Search modules…") finds a module by name; press "/" to jump to it.
- Inside a module, the tabs along the top are its screens. Each tab has its own colour and icon.
- The top bar shows the page name, today's date, who you are, a "📖 Help for this page" button and Sign Out.
- On a phone the sidebar becomes a menu and the tabs become a scrolling row; everything works with the same login.

### Roles and permissions

Admin, Administrator and Co-Admin are the administrator roles: they can open every module and do every action.

Everyone else has a role such as Manager, Accountant, Teacher, Hostel or Reception. For each module the admin decides what that role may do: Read, Add, Edit, Delete. These are set by an admin in Admin → 🛡️ Permissions (and Overrides for a single person).

If a button is missing or you see "Access denied", you do not have that permission — ask the admin; do not try to work around it.

> Important actions are double-checked by the database itself, not only by the screen. For example, only an admin can change or revert a recorded payment, and a revert needs a second admin to approve it.

### Keeping the data safe

- Never share your login. Everything you do is recorded with your name.
- Sign out on shared computers.
- Corrections to money (amount, month, date, hostel type) need a written reason and leave an audit record you cannot delete.
- If you see the orange banner "Secure database connection is off", press "Sign in again". Until then records may look empty or show ₹0 — the data is safe.

### Getting help

- Open Help & Training from the sidebar, or press "📖 Help for this page" at the top of any page, for the step-by-step guide of that module.
- "What's new" in Help & Training lists every change, newest first.
- For wrong data or lost access, contact the administrator.

## Part 2 — Words and rules you will meet

### Glossary

| Term | Meaning |
|---|---|
| GCC number | The student's ID, written GCC-1102. Search by it whenever two students have similar names. |
| Session | The fee year, April to March (for example 2026-2027). Fees for January–March belong to the session that began the previous April. |
| Admission fee | One-time fee charged in the month the student is admitted. Its default amount comes from Fee Setup. A repeater's admission fee is waived. |
| Flat fee | The hostel/flat fee charged for February and March (the "flat fee months"). |
| Course fee | The monthly tuition-type fee charged for all the other months. |
| Hostel type | Boarder, Day Boarder or Day Scholar. The fee rate depends on it, so a wrong hostel type means wrong dues. |
| Repeater | A student repeating the year. Marked on the student record; the admission fee is waived. |
| Concession | A reduction of a fee. A one-off low fee needs a reason and an admin's approval; a standing scholarship is recorded in Fees → Register. |
| Revert | Removing a recorded payment. It is not instant: a different admin must approve it. |
| Month lock | Accounts can close a month. Non-admins cannot post fees dated in a closed month. |
| Day closing | End-of-day cash check in Fees → Day Close. |
| Student status | Active, Inactive, Passed Out, Withdrawn or Dropout. Only Active students appear in fee dashboards and dues. |
| Roll call | The housemaster's morning and night attendance of the hostel, marked in the Hostel module. |
| Six mandatory tabs | Discipline, Sickbay, Repairs, Journal, Mess Duty and Activities — a housemaster must log them every day. |

### Fee rules in one page

- Fees come from Fee Setup by session, course, batch and hostel type. If a combination is not configured, billing falls back to old built-in amounts — Fee Setup shows a red "NOT CONFIGURED" tag.
- Collecting less than the standard fee needs a reason; the shortfall stays due until an admin approves a concession.
- A concession above ₹2,000 cannot be approved by the person who raised it (unless there is only one admin).
- Amounts must be above zero and at most ₹5,00,000; payment dates cannot be in the future.
- Corrections (amount, month, date, hostel type) need a reason of at least 5 characters and are written to the audit log first.
- A revert or delete is requested by one admin and approved by a different admin in Fees → Approvals.
- Each receipt has a QR code. Anyone can scan it to check it is genuine; staff can also use Fees → Verify.

### Hostel discipline rules

- Morning roll call is due by 7:00 AM and night roll call by 8:00 PM. A pre-deadline reminder is sent at about 5:30 AM and 6:30 PM.
- The six mandatory tabs must be logged every day.
- A missed roll call or unlogged tab is recorded automatically (the next morning) and flagged to the housemaster and all admins; it carries the same penalty notice as a late roll call.
- Housemasters on approved leave are skipped.

## Part 3 — Daily, weekly and yearly routines

### Fee counter / accountant — every day

1. Collect fees in Fees → Fee Payment and hand over the printed receipt.
2. Give a reason whenever you collect less than the standard fee.
3. At the end of the day, count the cash and complete Fees → Day Close.
4. Check Fees → Approvals and Low Fees for anything waiting for a decision.

### Reception — every day

1. Sign visitors in and out, record admission enquiries and complaints, and handle student leave and gate passes in Reception.
2. Enter new admissions in Admissions; use Bulk Admission for a batch.
3. Check Notice for messages from the office.

### Teachers — every day

1. Mark Attendance for your classes first.
2. Write the Daily Log in Teaching (the system checks you are on campus and that attendance is done).
3. Enter marks for tests in Exams when a test is held.
4. Apply for leave in Leave when needed.

### Housemasters / wardens — every day

1. Complete the morning roll call before 7:00 AM and the night roll call before 8:00 PM.
2. Log Discipline, Sickbay, Repairs, Journal, Mess Duty and Activities.
3. Check the house report that appears when roll call reaches 100%.

### Administrators — weekly

1. Fees → Data Health: fix students with missing course, hostel type, phone or admission date.
2. Fees → Digest: review corrections, reverts and concessions; follow up the red flags.
3. Fees → Reminders: send dues reminders and record promise-to-pay dates.
4. Fees → Instalments and Register: review overdue plans and expiring concessions.
5. Hostel: read the neglect report for missed roll calls and tabs.

### Administrators — every month

1. Export Fees → Dashboard → Month-wise Dues for the meeting.
2. Check Accounts against the fee collections, then close the month.
3. Review Reports and the Admin audit log.

### Administrators — every April (new session)

1. Open Fees → Rollover (planner) to see promotions, repeaters and dues to carry forward.
2. In Fee Setup, enter the fees for the new session for every course, batch and hostel type.
3. Promote students and mark repeaters in Students.
4. Close the March books in Accounts.

## Part 4 — Module guides

### Core

### 1. Dashboard

_Used by: Admin, Any staff_

The first screen after login. Admin sees a full school overview with live numbers. Other staff see a simple page with buttons for the modules they are allowed to use.

**Before you start**

- You must be logged in.
- Staff (non-admin) only see modules that the Admin has given them access to. If the list is empty, ask the Admin.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Overview | Admin only. Daily Briefing, live fee collection, and the main numbers (students, batches, present today, fee pending, net profit/loss). |
| 360° Health | Admin only. Checks security and data problems in all modules and gives a health score out of 100. |
| Intelligence | Admin only. Extra insights built from the school data. |
| Finance | Admin only. Total collected, fee pending, admission fee, flat fee, course fee and waivers. |
| Students | Admin only. Total students, boys, girls, boarders, day boarders and day scholars. |
| Dropout | Admin only. Total dropouts, dropout rate and retention rate. |
| Admissions | Admin only. Number of applications at each stage: Applied, Under Review, Admitted, Enrolled, Rejected, Waitlisted. |
| Staff & HR | Admin only. Total staff, active staff, salary bill and task counts. |
| Attendance | Admin only. Present, Absent, Late and attendance rate for today. |
| Academic | Admin only. Average score, pass rate, A+ students and students at risk. |
| Tests | Admin only. Exam dates, entries, average score and students at risk. |
| Enquiry | Admin only. Applications received, open ones, enrolled ones and conversion rate. |
| Hostel | Admin only. Boarders, rooms, occupied rooms and incidents. |
| Houses | Admin only. Summary for each hostel house. |
| Operations | Admin only. Total, completed, pending and overdue tasks. |
| Batches | Admin only. Total batches, active batches, strength and fill rate. |
| Doubts | Admin only. Student doubts: total, resolved, unresolved and average time to resolve. |
| Parents | Admin only. Messages sent to parents and how many were delivered or failed. |
| Study Material | Admin only. Study materials and how many have been given out. |
| Results | Admin only. Exam results summary. |
| Teaching | Admin only. Teaching summary. |
| Fee Setup | Admin only. Fee setup summary. |
| Fee Ledger | Admin only. Fee ledger summary. |
| Entrance Exam | Admin only. Entrance exam summary. |
| Study Lockers | Admin only. Study locker summary. |
| Syllabus | Admin only. Syllabus summary. |
| Question Bank | Admin only. Question bank summary. |
| Social | Admin only. Social media summary. |
| Connect | Admin only. Connect summary. |
| Expenses | Admin only. Income and expense summary. |

**How to…**

#### 1.1 Open a module from the staff dashboard (non-admin staff)

1. Log in. The Dashboard opens by itself.
2. You will see a greeting such as "Good Morning" and today's date.
3. Find the module you want under "Your modules" (on a phone, the tiles are grouped by CORE, FINANCE and so on).
4. Click or tap the module tile. The module opens.

> 💡 On a phone, the first four modules also appear as quick buttons at the top.

#### 1.2 Search for a module (non-admin staff)

1. On a phone, type in the "Search your modules…" box under the greeting.
2. Only your modules that match the typed name stay on the screen.
3. Tap the module you want.

#### 1.3 Read the Daily Briefing (Admin)

1. Open Dashboard. The Overview tab shows first.
2. Read the "☀️ Daily Briefing" box. Each line has a small tag (Critical, Watch, Nominal or Note).
3. The most serious items are listed first. Deal with Critical items first.
4. If it says "No items require attention today", nothing needs action.

#### 1.4 Move between sections (Admin)

1. Use the row of tabs at the top (Overview, 360° Health, Finance, Students and so on). On a phone a section menu is shown instead.
2. Click a tab. Only that section is shown.
3. Click the section title bar to open or close the section.

> 💡 Every section except Overview starts closed. Opening a tab opens the section for you.

#### 1.5 Go from a number to its module (Admin)

1. Find the number card you are interested in, for example "Fee Pending".
2. Click the card.
3. The matching module opens (for example Fees, Students, Admissions or Attendance).

> 💡 Cards open the module where that data lives. For example, Fee Pending opens Fees and Net P&L opens Accounts.

#### 1.6 Run the 360° Health Check (Admin)

1. On the Overview tab, click "🛡️ 360° Health Check". You can also open the "360° Health" tab.
2. Wait while "Scanning all modules…" finishes.
3. Read the score and the list of issues. Each issue says which module it is in and how to fix it.
4. Where an issue has an automatic Fix button, read the message and confirm to apply it.

> 💡 The page also has an option to download the health report as a CSV file.

#### 1.7 Turn on phone notifications (Admin)

1. On the Overview tab, click "🔔 Enable Notifications".
2. Allow notifications when your browser asks.
3. A message says push notifications are enabled. If it says you are already subscribed, nothing more is needed.

**Good habits**

- The Dashboard only shows numbers. To change anything, open the module itself.
- Click "Retry" if the dashboard shows an error while loading.
- The "Live Fee Collection" box shows total fees collected for the current academic year (April to March).
- In the Finance box, "Pending amount not tracked yet" means the pending amount is not calculated here. Use the Fees module for dues.

**Common mistakes**

- Expecting a module to show on the staff Dashboard when it is missing → ask the Admin to give you access to it.
- Trying to fix data on the Dashboard → open the module (click the number card) and change the data there.
- Ignoring Critical items in the Daily Briefing → check them first every morning.

**Questions people ask**

- **Why do I see only a few modules?** The Dashboard shows only the modules the Admin has given you access to. Ask the Admin to add more.
- **Why is my Dashboard different from the Admin's?** Admin gets the full school overview. Other staff get a simple page with buttons to their own modules.
- **What does the 360° Health score mean?** It is a score out of 100 built from the issues found in security and data checks. Fixing issues raises the score.
- **Are the numbers live?** They load when you open the page. Reload the page to get the latest figures.

### 2. Students

_Used by: Admin, Reception, Accountant, Teacher, Housemaster_

The register of all enrolled students. Look up a student, see attendance, exam scores and fees, edit details, and run reports. New students are NOT added here. They come from Admissions.

**Before you start**

- A student appears here only after Admissions → Enroll has been done.
- What you can do depends on your role. Edit, Delete, Merge and Rollover need Admin (or Manager) rights. Fee needs Admin or Accounts. Exams and Attendance need Admin, Teacher (Attendance also Hostel).
- Phone numbers, father name and address are hidden for roles that are not allowed to see them.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Courses | Students grouped by course and batch, with course-wise counts. This tab opens first. |
| Dashboard | Charts and summary numbers for all students. |
| All Students | The full student list as cards, with search, filters, selection, bulk actions, export and archive. |
| Scholarship/Waiver | The record book of all scholarship and fee waiver requests, with pending ones to approve or reject (Admin). |
| Data Quality | Shows students with missing details so you can complete them. |

**How to…**

#### 2.1 Find a student

1. Open Students and click the "All Students" tab.
2. Type a name or GCC number in the search box.
3. Use the filter dropdowns (for example status, course, hostel, house, gender, session, batch) to narrow the list.
4. Click "✕ Clear" to remove all filters.
5. Click a student card to open the student details.

> 💡 Click "⭐ Presets" to save a set of filters and reuse it later.

#### 2.2 See a student's full profile

1. Click the student card.
2. A side panel opens with tabs: Profile, Academic, Attendance, Fees, Scholarship/Waiver, Documents and Notes.
3. Click each tab to see that information.
4. Close the panel when you are done.

#### 2.3 Add a new student

1. Students cannot be created here.
2. Click "New Admission" (shown to users who can edit). It takes you to Admissions.
3. In Admissions, create the application, collect the admission fee and click Enroll.
4. The student then appears here.

> 💡 This keeps the chain Admissions → Students → Fees → Accounts correct.

#### 2.4 Edit student details

1. On the student card click the Edit (pencil) button. Only Admin or Manager roles see it.
2. Change the details. Name and GCC No. are required.
3. Fill sections such as Course & Class, Family & Contact and Medical & Notes as needed.
4. Save the form. A message "Student updated" appears.

> 💡 The GCC No. cannot be changed on an existing student. Scholarship and waiver are not edited here. Use a request (see below).

#### 2.5 Request a scholarship or fee waiver

1. Open the student and click the "Scholarship/Waiver" tab.
2. Click "+ New Request" (needs Fees rights).
3. Choose Scholarship or Fee Waiver, enter the amount and the Reason.
4. Submit. You can print the request form.
5. An Admin then approves or rejects it in this tab or in the main "Scholarship/Waiver" tab. Admin has to enter a PIN to approve or reject.
6. Once approved, it is applied to the student's fees.

> 💡 The amount must be more than zero.

#### 2.6 Archive a student and undo it

1. On the student card click the Delete (dustbin) button. Only Admin or Manager see it.
2. Read "Archive Student" and click "Archive".
3. A bar appears for 7 seconds. Click Undo if it was a mistake.
4. Later, click the "Archive" button in the toolbar to see archived students and press "↩ Restore" to bring one back.

> 💡 Archive hides the student. It does not delete the record.

#### 2.7 Do an action for many students (bulk)

1. In "All Students", tick the boxes on the cards, or click "☑ Select Page".
2. A bar appears with buttons: Bulk Actions, Reassign House, Bulk Fee and Scholarship/Waiver.
3. Bulk Actions lets you Change Status, Promote, Change Session, Change Batch or Archive the selected students.
4. Bulk Fee asks for Amount / Student, Month For (for example Jan 2026) and Method, then collects that fee for every selected student.
5. Confirm the question. Click the round "x" button to clear the selection.

> 💡 Bulk Fee needs Fees rights. Check the total in the confirm message before you press OK.

#### 2.8 Move students to the next session (Rollover)

1. Click "Rollover" in the toolbar (Admin or Manager only).
2. Step 1: pick the Source Session and Target Session.
3. Step 2: check the preview. It shows each student's new batch and session. Students with no next batch will become "Passed Out".
4. Step 3: click "Execute Rollover".

#### 2.9 Download lists and reports

1. Click "Export" in the toolbar (Admin, Manager or Accounts). Choose Student List (CSV), Student List (PDF) or Parent Contacts.
2. Click "Reports" to open the report maker and print a professional report.

**Good habits**

- The coloured numbers at the top show Active students, average attendance, boarders and fee dues.
- Click "Refresh" if the list does not look current.
- Use the Data Quality tab to find students with missing phone, address or other details.
- Use "Merge" (Admin) to combine duplicate student records.
- The Courses tab remembers the course you last looked at.

**Common mistakes**

- Trying to add a student with a form here → go to Admissions and enrol the applicant instead.
- Changing a student to Dropout/Withdrawn in Admissions → do this in Students. Admissions blocks status changes for enrolled students.
- Bulk Rollover before checking the preview → always read step 2.
- Not seeing Edit or Delete buttons → your role is read-only for those. Ask Admin.

**Questions people ask**

- **Why can I not see a student?** Archived students are hidden. Check the "Archive" button. Also check that filters are cleared. Students not yet enrolled in Admissions are not listed.
- **Can I change a GCC number?** No. The GCC No. links the student with Admissions, Fees and Accounts and cannot be changed on an existing student.
- **Who approves scholarships and waivers?** An Admin, using a PIN. Until then the request stays pending.
- **Where do I mark attendance?** In the Attendance module. Here the Attendance button only shows the record.
- **How do I mark a student as left the school?** Edit the student and change Status (Inactive, Passed Out, Withdrawn or Dropout). A Left Date field appears.

### 3. Admissions

_Used by: Admin, Reception_

Take new admission applications, collect the admission fee, and move each applicant step by step to Admitted and Enrolled. Enrolling creates the student record.

**Before you start**

- Admin should have an Active session set (in Admission Sessions). New applications are tagged to it. If the session is locked, nothing can be saved.
- Fee Setup should have the fee rates entered. The monthly fee shown after saving comes from them.
- Keep the documents ready: birth certificate, Aadhaar, photo, mark sheet and similar.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📝 New Application | The step-by-step application form. |
| 📋 Applications | The list of all applications with counts, search, filters and actions. |
| 🔗 Student Ledger | Search one student and see the connected student record and full fee history. |
| 📅 Sessions | Create sessions, make one Active and Lock or Unlock it. |

**How to…**

#### 3.1 Take a new application

1. Click the "📝 New Application" tab.
2. Go through the steps: Programme, Candidate, Parents & Contact, Address, Schooling, Exam Registration, GNSI Assessment, Documents.
3. Fill all required fields. Missing items are listed. The GCC No. is suggested as the next free number. Change it if needed.
4. Phone, WhatsApp and Emergency phone must be 10 digits.
5. Tick the enclosures and the declaration on the Documents step.
6. Click "Review application →", check everything, then click "✓ Confirm & submit application".

> 💡 If the screen closes by mistake, an "Unsaved draft found" bar offers "Resume draft".

#### 3.2 Collect the admission fee

1. After you submit, the fee window opens by itself and the status stays "Applied".
2. Collect the admission fee there.
3. If you closed it, click "Collect Fee" (or "Fee Account") on the applicant's card later.

#### 3.3 Admit the applicant

1. Open the "📋 Applications" tab.
2. Find the applicant with status Applied or Under Review.
3. Click "Admit" and confirm "Mark as Admitted?".
4. The status becomes Admitted.

#### 3.4 Enroll the student

1. Find the Admitted applicant whose admission fee is paid.
2. Click "Enroll →" and confirm.
3. The student record is created and the status becomes Enrolled.
4. If the admission fee is not paid, you get "Collect admission fee first" and the fee window opens.
5. If the chosen house is full, enrollment stops with a message and the status stays unchanged.

> 💡 Enroll one student at a time. Bulk change to Enrolled is blocked.

#### 3.5 Search and filter applications

1. In "📋 Applications", click a status box (Applied, Under Review, Admitted, Enrolled, Rejected, Waitlisted) to show only that status. Click it again to show all.
2. Use the Session, Course, Batch, Hostel and House strips to narrow the list.
3. Use "🔎 Advanced" for more filters.
4. Switch the view with the four small view buttons (cards, table, kanban, gallery).

#### 3.6 Edit an application or change status quickly

1. Open the card and use Edit to change the full application.
2. Use the quick edit to change status, house, follow-up date or bed number only.
3. Save. Status "Enrolled" can only be set with the Enroll button.

> 💡 The GCC No. cannot be changed after enrollment or after any fee is collected.

#### 3.7 Delete a wrong application

1. Only Admin can delete. Click the delete button on the card and confirm.
2. A message shows for 5 seconds with an Undo option.
3. After 5 seconds the record is removed for good.

> 💡 Enrolled applicants, or those with fees collected, cannot be deleted. Set them to Rejected, or revert the fees in Fees first.

#### 3.8 Import, export and bulk actions

1. Click "📥 Import" and paste a CSV with the headers name, gcc_no, gender, dob, course, batch, house, hostel_type, session, phone, father_name, status.
2. Click "📤 Export" to download the list. Confirm the warning because the file has phone numbers and addresses.
3. Tick several cards for bulk actions (Admin): set status, set house, export, print, WhatsApp blast or delete.
4. "Auto-assign house" shares unassigned boarders across the houses.

**Good habits**

- The top card shows Total applications, Admitted, Enrolled, Pending and the monthly revenue.
- The progress line shows the flow: Applied → Under Review → Admitted → Fee Collection → Enrolled → Student.
- Keyboard shortcuts shown on the page include N for a new application and V to change the view.
- Use "Viewing:" at the top to look at another session. It only changes this page.
- 📊 Analytics shows charts for the applications.

**Common mistakes**

- Enrolling before the admission fee is paid → collect the fee first.
- Date of birth outside the exam window → the form refuses it. Check the date and the course.
- Typing the GCC No. wrongly and fixing it after fees → it cannot be changed then. Check it before saving.
- Creating applications while the session is locked → ask Admin to unlock the session.
- Deleting an enrolled student's application → mark the student Dropout or Withdrawn in Students instead.

**Questions people ask**

- **Who can create applications?** Admin and Reception can create. Delete and bulk actions are for Admin only. Other staff can mostly view and edit.
- **Where do new students appear?** In Students, after you click Enroll.
- **What if I get "Session locked"?** The active session is locked. Ask Admin to unlock it in the Sessions tab.
- **Can I enroll many students together?** No. Enroll each one with the Enroll button so the fee is checked.
- **Why is my date of birth refused?** The date must fall in the official window for the course exam (AISSEE or JNVST) and the class applied for.

### 4. Bulk Admission

_Used by: Admin, Accountant, Reception_

Collect admission fee, dress fee and prospectus fee for many enrolled students in one go, and print all the receipts together. It lists enrolled students whose admission fee has not been collected yet.

**Before you start**

- The student must already be Enrolled in Admissions.
- Only students with no admission fee collected (or whose admission fee was reverted) appear in the list.
- If the Accounts month for your payment date is closed, collections dated in that month are blocked. Ask Admin.

**How to…**

#### 4.1 Set the payment details for the whole batch

1. Open Bulk Admission. Wait for "Loading enrolled students…" to finish.
2. In "Global payment settings", choose the Payment Mode.
3. Check the Payment Date. It starts as today.
4. Check "Collected By". It starts with your name. It is required.
5. If the mode is not Cash, type the "Txn Ref / Cheque No.". It is required for every non-cash mode.

> 💡 These four settings apply to all selected students.

#### 4.2 Find and select students

1. Type in the search box ("Search name, GCC, class…") to find students.
2. Use the course dropdown to show only one course.
3. Click a student row to tick it. You can also click "☑ Select all" to tick everyone shown, and "☐ None" to clear.
4. The top right shows how many are selected and the total in rupees.

#### 4.3 Choose the fee items and amounts

1. On each student row there are three items: Admission Fee, Dress Fee and Prospectus Fee.
2. Admission Fee is ticked by default. Tick Dress Fee or Prospectus Fee if the student is paying them.
3. Change the amount in the small box if needed. Defaults are 6000 for Admission Fee, 3000 for Dress Fee and 200 for Prospectus Fee.
4. To set the same amount for all selected students, type it in "Apply fee amount to all selected students" and click outside the box.

> 💡 Select the students first, then use the "→ all selected" amount boxes.

#### 4.4 Save and generate receipts

1. Check the bottom bar. It shows "students" and the total amount.
2. Click "💾 Record & Generate Receipts".
3. Read the question and click OK.
4. Wait while the progress bar runs (for example 5 / 20).
5. When it finishes, a "Receipts ready" window opens.

> 💡 Click "Cancel" in the bottom bar to clear your selection before saving.

#### 4.5 Print the receipts

1. In the "Receipts ready" window, check the list of students and amounts.
2. Click "🖨️ Print all receipts".
3. In the print window, print or save as PDF. Each student gets one A4 receipt.
4. Click "Close" when done.

#### 4.6 Check for problems after saving

1. Look for an orange message at the top of the page.
2. A line with "failed" lists students whose save did not work, with the reason.
3. A line with "Already collected, skipped" lists items that were already paid. They are not charged twice.
4. The list refreshes. Students who were saved leave the list.

**Good habits**

- The page header shows how many students are pending admission fee and how many were processed in this visit.
- Receipts use the same design as all other fee receipts, and the payments appear in Fees and Accounts.
- Do a small batch first if you are unsure.

**Common mistakes**

- Saving without "Collected By" → type the staff name first. The page will not save without it.
- Choosing UPI, Bank Transfer or Cheque and leaving the reference empty → type the transaction or cheque number.
- Leaving all three items unticked for a student → that student is skipped and gets no receipt.
- Closing the receipt window before printing → the fees are already saved. Ask Admin how to reprint a receipt from the Fees module.

**Questions people ask**

- **Why is a student missing from the list?** Only Enrolled students without an active admission fee payment are listed. If the student is not Enrolled, finish enrollment in Admissions. If the fee was already paid, the student is not shown.
- **What if I collected a fee by mistake?** Do not collect again. Revert the payment in Fees. The student then comes back into this list.
- **Can I collect only the dress fee?** Yes. Untick Admission Fee and tick Dress Fee for that student. The admission fee stays pending.
- **Does it update Accounts?** Yes. Each payment is recorded the same way as in Fees, so it appears in Accounts.

### 5. Sessions

_Used by: Admin_

Create and manage academic year sessions such as "2025-26". Choose which session is Active, so new admissions are tagged to it, and Lock a session to stop new applications. Admin only.

**Before you start**

- Only Admin can open this page. Other users see "Access Denied".
- This page does not appear in the sidebar list. Admin opens it through the app when needed.

**How to…**

#### 5.1 Create a new session

1. Click the "+ New Session" button at the top right.
2. Type the Session Name, for example 2025-26. This field is required.
3. Optionally pick the Start Date and End Date. If the Session Name is empty, picking a Start Date fills in a name for you.
4. Optionally add Notes / Description.
5. Click "Create Session".

> 💡 A new session always starts as Inactive. If the name already exists, you get a message "already exists".

#### 5.2 Make a session Active

1. Find the session card.
2. Click "✅ Activate".
3. Read the question and click OK. The previous active session is switched off.
4. The green banner at the top now shows the new active session.

> 💡 Only one session can be Active at a time. Activating also removes any lock on that session.

#### 5.3 Lock a session so no new applications can be made

1. Find the active session. You can use "🔒 Lock Session" in the banner or "🔒 Lock" on the card.
2. Read the warning and confirm.
3. The badge changes to "Active · Locked". New applications are blocked in Admissions.
4. Existing records can still be edited.

#### 5.4 Unlock a session

1. Click "🔓 Unlock Session" in the banner, or "🔓 Unlock" on the card.
2. The session opens for new applications again. There is no extra question.

#### 5.5 Deactivate a session

1. Click "Deactivate" on the active session card.
2. Confirm the message.
3. Now no session is active. A yellow "No active session" warning appears and Admissions will not auto-assign a session.
4. Activate another session to continue admissions.

#### 5.6 Edit a session

1. Click "Edit" on the session card.
2. Change the name, dates or notes.
3. Click "Update Session".

#### 5.7 Delete a session

1. Click "Del" on the session card. It is greyed out for the active session.
2. Read the warning. If the session has admission records, the records are NOT deleted, but they are no longer linked to a managed session.
3. Confirm. This cannot be undone.

> 💡 Deactivate a session first if you want to delete it.

**Good habits**

- The top boxes show Total Sessions, the Active Session, Locked Sessions and Total Admissions across all sessions.
- Each card shows how many applications that session has.
- To keep an old year safe, deactivate it. Its admission records stay.
- Use one naming style for all sessions (for example always 2025-26) so they look the same everywhere.

**Common mistakes**

- Deleting a session that has applications → deactivate or lock it instead.
- Forgetting to activate the new year → create the session, then click "✅ Activate".
- Locking the active session by mistake and wondering why new applications fail → click "🔓 Unlock Session".

**Questions people ask**

- **Can two sessions be active together?** No. Activating one session turns off the other.
- **What does Lock do?** It stops new admission applications for that session. Existing records can still be edited.
- **Why can I not delete the active session?** The Del button is disabled for the active session. Deactivate it first.
- **What is the difference from the Admission Sessions page with seat numbers?** This page has Notes and no seat count. The other page (Admission Sessions) has Label and Total Seats. Both work on the same list of sessions.

### 6. Admission Sessions

_Used by: Admin_

Create academic year sessions, set total seats, activate one session and lock it. Each card shows how many admissions the session has and how full it is. Admin only.

**Before you start**

- Only Admin can open this page. Other users see "Access Denied".
- This page is not in the sidebar list.

**How to…**

#### 6.1 Create a new session

1. Click "➕ New Session" at the top right.
2. Type the Session Name, for example 2025-26. It is required.
3. The Label fills in automatically as "Academic Year 2025-26". You can change it.
4. Pick the Start Date and End Date (optional).
5. Type Total Seats, for example 100 (optional).
6. Click "Create Session".

> 💡 If the same Session Name already exists, you get a message and nothing is saved.

#### 6.2 Activate a session

1. Find the session card. Only sessions that are not Active and not Locked show the button.
2. Click "▶ Activate".
3. Confirm. The current active session is switched off.
4. The green banner "Currently Active Session" shows your session and its admission count.

#### 6.3 Lock a session

1. On the active session card, click "🔒 Lock Session".
2. Confirm. No new admissions will be accepted.
3. The card shows a "🔒 Locked" badge.

#### 6.4 Unlock a session

1. On a locked card, click "🔓 Unlock".
2. Confirm. New admissions are allowed again.

> 💡 A locked session does not show the Activate button. Unlock it first.

#### 6.5 Edit a session

1. Click "✏️ Edit" on the card.
2. Change the name, label, dates or seats in the form.
3. Click "Update Session".

#### 6.6 Delete an empty session

1. The "🗑 Delete" button shows only for a session that is not Active and has 0 admissions.
2. Click it and confirm. This cannot be undone.

**Good habits**

- When Total Seats is set, the card shows "Seat utilisation" with a bar and the seats remaining. The bar is green, then amber from 70%, then red from 90%.
- The three boxes show Total Sessions, Total Admissions and the Active Session.
- The Session Name is used on all admission records, so choose it carefully.

**Common mistakes**

- Looking for Delete on a session that has admissions → it is hidden by design. Lock or deactivate it instead.
- Leaving Total Seats empty and expecting a seat bar → type the seats number to see it.
- Creating the same session twice → check the list first. Duplicates are refused.

**Questions people ask**

- **Can several sessions be active?** No. Activating one session turns the others off.
- **Where are the seat numbers counted from?** The card counts admission records whose session matches the Session Name.
- **What does Lock do?** It stops new admissions for that session.

### Finance

### 7. Fees

_Used by: Admin, Accountant, Reception_

Collect fees, print receipts, see who owes what, and control corrections and concessions. Everyone with Fees access can collect; admins also get the reports, approvals and planning tools.

**Before you start**

- Fee Setup must have the fees for the student's course, batch and hostel type (otherwise old built-in amounts are used).
- The student must exist in Students with the correct course, batch, hostel type and admission date.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Dashboard | Money summary, dues by month, session progress, and lists of students who need attention. Every section has an Export button. |
| Fee Payment | Collect a fee and print the receipt. |
| Live Summary | Live list of every student with paid, due and status. |
| Student Ledger | One student's full fee history (opens the ledger). |
| Admin View | Admin list of all payments and transactions with filters. |
| Reports | Reports & Export Centre: download fee reports, including Dues Reports (admin). |
| Past Dues | Students who left but still owe money (admin). |
| Activity Log | Who changed what in the fees, with before/after (admin). |
| Anomalies | Unusual payments flagged for review (admin). |
| Warnings | Audit warnings such as payments below the standard rate (admin). |
| Approvals | Revert / delete requests that a DIFFERENT admin must approve (admin). |
| Low Fees | Payments below the standard fee that need a decision: approve the concession or refuse it (admin). |
| Hostel Issues | Students whose hostel type does not match their hostel bed, which changes the fee (admin). |
| Digest | 7- or 30-day summary of corrections, reverts and concessions with red flags (admin). |
| Data Health | Students with missing or wrong data (GCC, course, hostel type, phone, photo) (admin). |
| Reminders | Send WhatsApp dues reminders, keep a log and record promise-to-pay dates (admin). |
| Instalments | Agree an instalment plan for a student who cannot pay in one go (admin). |
| Register | Concession Register: standing scholarships/concessions that reduce dues automatically (admin). |
| Refunds | Refund, credit and write-off requests with approval (admin). |
| Day Close | Daily Closing: count the cash and reconcile it with recorded receipts (admin). |
| Verify | Check whether a printed receipt is genuine. |
| Rollover | Plan the April changeover. Read-only: it changes nothing (admin). |

**How to…**

#### 7.1 Collect a fee

1. Open Fees → Fee Payment (or press "＋ Collect Fee" at the top).
2. Search the student by name or GCC number and select them.
3. Choose what is being paid: admission, flat fee (Feb/Mar), course fee month(s), or items.
4. Check the amount. The standard amount is filled in for you.
5. Choose the payment date and mode (Cash, UPI, Card, Cheque, Bank).
6. If you collect LESS than the standard fee you must choose a reason (and write an explanation for "Other"). A non-admin's request waits for admin approval; the missing amount stays due until then.
7. Press the collect button and print the receipt.

> 💡 Dates in the future, zero or negative amounts, and very large amounts are refused. Check for typing mistakes.

#### 7.2 Find who owes money

1. Open Fees → Dashboard.
2. Look at "Month-wise Dues": it runs from January up to this month. Tap a month to see the students who owe, with their amounts.
3. Tags show PARTIAL (paid something), + ADMISSION (owes admission fee) and ON PLAN / PLAN OVERDUE (has an instalment plan).
4. Use the Export button to download the list (CSV, Excel or Print).

#### 7.3 Send reminders to parents

1. Open Fees → Reminders (admin).
2. Filter by course, hostel, minimum amount, or "not reminded in N days".
3. Tick the students, edit the message if you want, then press WhatsApp on a row (it opens WhatsApp with the message ready).
4. To record what the parent promised, type the promise date and a note on the row and save.
5. Students with an ON PLAN tag already have an agreed schedule — do not chase them early.

> 💡 You still press Send in WhatsApp yourself; the system logs the reminder when you open it.

#### 7.4 Set up an instalment plan

1. Open Fees → Instalments (admin).
2. Pick the student; their current dues are shown.
3. Enter the total, number of instalments, the first due date and the interval, then give a reason (at least 5 characters).
4. Review the split (the last instalment takes the rounding) and save.
5. When a parent pays an instalment, collect it normally in Fee Payment, then mark that instalment paid in the plan.

> 💡 A plan does not reduce what is owed; it records the agreement and flags overdue instalments.

#### 7.5 Approve or refuse a low fee

1. Open Fees → Low Fees (admin).
2. Read the student, month, standard fee, collected amount, reason and note.
3. Press Approve to waive the shortfall (the month becomes settled) or Refuse (the balance stays due).
4. You cannot approve a concession above ₹2,000 that you raised yourself — another admin must approve it (unless you are the only admin).

#### 7.6 Correct a mistake (wrong amount, month or date)

1. Open Fees → Student Ledger, find the student, and open the "Fix" panel for the month.
2. Choose the correction: change the amount, move the payment to another month, or fix the date.
3. Type a clear reason (at least 5 characters). The system saves an audit record first; if that fails, nothing changes.
4. To remove a payment completely, ask for a revert: a DIFFERENT admin must approve it in Fees → Approvals.

> 💡 Staff who are not admins cannot change recorded payments — the database blocks it.

#### 7.7 Close the day

1. Open Fees → Day Close (admin) at the end of the day.
2. Check the date. The recorded receipts by payment mode and by collector are shown.
3. Count the cash in hand and type it in. The difference is shown; any difference needs a note.
4. Save the closing. An admin can reopen a day with a reason if a late correction is needed.

> 💡 A morning alert tells admins about earlier days that have collections but no closing.

#### 7.8 Record a standing concession (scholarship)

1. Open Fees → Register (admin).
2. Choose the student, the kind, how it is applied (fixed per month, percent or one time), the value, which fees it covers, the start date and optional end date, and the reason.
3. Save. From then on the dues for those months are reduced automatically everywhere.
4. When it should stop, press Revoke and give a reason.

#### 7.9 Check a receipt is genuine

1. Open Fees → Verify, or scan the QR code printed on the receipt.
2. Type the receipt number, and optionally the amount printed on paper.
3. The result says Genuine, Reverted, not found, or that the amount does not match the books.

> 💡 Parents can scan the same QR code on their phone to see yes/no for their own receipt.

**Good habits**

- Always search by GCC number when two students have similar names.
- Use Fees → Data Health weekly: most wrong dues come from wrong student data (course, hostel type, admission date).
- Export buttons exist on every Dashboard section — use them for meetings instead of screenshots.
- Repeater students are not charged admission; continuing students (admitted in an earlier session) owe no new admission fee.

**Common mistakes**

- Collecting less than the standard fee without a reason → choose the reason; the shortfall stays due until an admin approves it.
- Entering the wrong month → ask an admin to use the Fix panel (move payment) instead of collecting again.
- Forgetting to close the day → close it before leaving; unclosed days show in the admin alert.
- Changing a student's hostel type "for all months" casually → it re-prices every month; only do it when the record was wrong, and give a reason.

**Questions people ask**

- **Why can I not post a payment dated last month?** The month may be closed in Accounts. Non-admins are blocked from closed months; ask an admin.
- **Why is a student with a scholarship still showing dues?** The scholarship must be in Fees → Register, active, and cover that month and fee type.
- **What does PARTIAL mean?** The student paid something for that month but less than the full fee.
- **Who can approve a revert?** A different admin from the one who asked for it. If there is only one admin the system allows self-approval.

### 8. Accounts

_Used by: Admin, Accountant_

The money book of the institute. Staff enter expenditure here, and everyone can see the books and reports. Income is not typed here: it comes in by itself when fees are collected (Fees) and when store sales are made (Store).

**Before you start**

- Fees must be collected in the Fees module and sales made in the Store module, because income appears in Accounts from there.
- Keep the bill or receipt ready. You can attach a photo or PDF to each entry.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Transactions | The main list of all entries. Search, filter and open any entry to see details, edit or delete. |
| Daily Book | Entries grouped day by day, with cash and bank totals. You can export CSV or print. |
| Expenditure | Daily Expenditure: only expense entries, grouped by entry date. |
| Expenditure Day Book | A printable day book of expenses for a date range. Filter by head, mode or search. |
| Income & Expenditure | Cash-book style register: Day-wise, Daily summary, and Income & Expenditure a/c views. Print it. |
| Reconciliation | Admin only. Tick entries that match the bank statement, and close or reopen a month. |
| Balance Sheet | Admin only. Trial balance made from the journal entries. |
| Analytics | Charts: monthly income vs expense, net balance trend, top categories, and AI Financial Insights. |
| Income Analysis | All income categories with this month's collection target. |
| Forecast | Admin only. Cash flow and where this month is heading. |
| Staff Spend | Admin only. How much each staff member is entering, and spend alerts. |
| Savings Tracker | Admin only. Daily and weekly income vs expense and savings rate. |
| Budgets | Monthly spending limit for each expense category, compared with actual spending. |
| Approvals | Admin only. Expenditure approval queue and the approval threshold amount. |
| For Admin | Admin only. One daily digest of everything that needs the Admin's attention. |
| Audit Monitor | Admin only. Course-wise fee collection and unusual-entry checks. |
| Activity Log | Admin only. A timeline of every add, edit and delete by every user. |
| Reports & Exports | Make letterheaded PDF, Word or Excel reports, including a one-click Monthly Report. |

**How to…**

#### 8.1 Add an expenditure entry

1. Open Accounts and press the gold "＋ Add Expenditure" button at the top.
2. Choose the Date. It cannot be in the future.
3. Choose the Category. Choose a Sub-category if you want (optional).
4. Choose the Vendor / Payee if you want (optional). You can add a new one from the list.
5. Type the Amount.
6. Choose the Payment Mode: Cash, Bank, UPI or Card.
7. Choose the Account Type: Cash A/c, 2026-27 A/c or 2025-26 A/c.
8. Choose the Voucher Head. This is the staff member who takes the money.
9. Set the Status (Confirmed or Pending) and type a Description / Note. The note is required.
10. Optional: attach the bill under "Receipt / Attachment" (image or PDF).
11. Press "✅ Save".

> 💡 Need many entries? Press "+ Add Row" to enter several rows and save them together.

#### 8.2 Find, check or edit an entry

1. Open the "Transactions" tab.
2. Type in the search box (category, note, voucher head, mode) or use the filters.
3. Click an entry to open its details.
4. Press "Edit" to change it, change the fields, then press "✅ Update".

> 💡 Entries made by Fees (student fee income) cannot be edited here. Fix them from Fees, Student Ledger.

#### 8.3 Delete an entry (Admin only)

1. Open the entry in the "Transactions" tab.
2. Press "Delete" and confirm the question.
3. Deleted entries are kept in a deleted list so Admin can restore one by mistake.

> 💡 Only Admin can delete. A permanent delete from the deleted list cannot be undone.

#### 8.4 Set monthly budgets

1. Open the "Budgets" tab.
2. Press "✏️ Edit Budgets" (shown only to Admin and Accountant).
3. Type the monthly limit for each expense category.
4. Press "✅ Save".

#### 8.5 Close a month (Admin only)

1. Open the "Reconciliation" tab.
2. Under "Bank Reconciliation", choose the account type and tick each entry that matches the bank statement.
3. Under "Month-End Close", press the month button (it shows 🔓 when open).
4. The button changes to 🔒. Now non-admin staff cannot add or edit entries dated in that month.
5. To open it again, press the 🔒 month button.

> 💡 Admin can still change a closed month. Close months only after checking the bank statement.

#### 8.6 Print a day book or register

1. Open "Expenditure Day Book" or "Income & Expenditure".
2. Choose the date range at the top.
3. In Expenditure Day Book, filter by Head or Mode if needed.
4. Press "🖨️ Print day book" or "🖨️ Print register".

#### 8.7 Make a monthly report

1. Open the "Reports & Exports" tab.
2. In "Monthly Report", pick the month.
3. Press the PDF, DOCX or Excel button.
4. For your own filters, use the report generator below on the same tab.

> 💡 The top "⬇ Export" button downloads the entries as a CSV file, and "📋 P&L" shows profit and loss.

**Good habits**

- The "▼ Summary" button at the top shows or hides the total cards.
- "Today's Summary" at the top shows today's income, expense and net.
- Attach the bill photo to every expense so the books can be checked later.
- Use the same category names every time so the reports stay clean.
- Pending entries are not counted in the totals. Confirmed entries are counted.

**Common mistakes**

- Trying to add fee income here → Income comes only from Fees and Store. Collect the fee in Fees.
- Wrong date in the future → Dates cannot be in the future. Use today or an earlier date.
- Entering the same recurring expense twice in one month → The system blocks a duplicate with the same note and amount. Check the existing entry.
- Adding an entry to a closed month → It is blocked for non-admin staff. Ask Admin to reopen the month.
- Editing a fee entry here → Go to Fees, Student Ledger and fix it there.

**Questions people ask**

- **Why is there no button to add income?** By design. Income is posted automatically when fees are collected and when store sales are made, so every rupee has a receipt behind it.
- **Why can I not delete an entry?** Only Admin can delete entries. Ask the Admin.
- **Why can I not add or edit an entry for last month?** That month has been closed by Admin. Ask Admin to reopen it.
- **I am a Superintendent. What can I do?** You can edit existing expenditure entries but not add new ones. You must type a reason when you save an edit, and Admin reviews every edit.
- **Who can see the Approvals, Reconciliation and Activity Log tabs?** Only Admin.

### 9. Student Fee Ledger

_Used by: Admin, Accountant, Reception_

A read-only record of every fee a student has paid, with month-wise dues, receipts and day books. Use it to check a student's account, reprint a receipt, or send a dues notice. You cannot change any payment here.

**Before you start**

- Fees must have been collected in the Fees module. Payments show here automatically.
- Fee Setup must have the correct fee amounts, so dues and "Short" months are right.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📒 Student ledger | Search one student and see their full fee record, receipts, month-wise register and statement. |
| 📅 Fee Day Book | All fee receipts for a day, week or month, with cash, UPI and other totals. Print it. |
| 🗓 Monthly Fee Ledger | One register for all students showing who has paid and who has dues. Print it. |
| 💸 Expenditure Day Book | Expense day book from Accounts. Shown only to users who can open Accounts. |
| ⚖️ Income & Expenditure | Income and expenditure register from Accounts. Shown only to users who can open Accounts. |

**How to…**

#### 9.1 Look up one student's fee record

1. Open Student Fee Ledger. The "📒 Student ledger" tab opens first.
2. Type in the search box: name, GCC No. or Adm. No.
3. Click the student from the list.
4. Read the cards: Admission & Kit, Flat Fees, Course Fees and Grand Total.
5. Use "📒 Register book" for the month-wise view or "🗂 By fee type" for lists by fee type.

> 💡 To clear the student and search another, use the clear button on the student card.

#### 9.2 Check month-wise dues and the statement

1. Open a student in "📒 Register book".
2. Choose the session at the top ("Session ...").
3. Press "📅 Month-wise" to see each month: Paid, Advance, Short, Due or Upcoming.
4. Press "🧾 Statement", choose From and To dates, to see the statement of account.
5. Press "📊 Insights" to see collection %, on-time payments and the next fee.

#### 9.3 Reprint a receipt

1. Open the student.
2. Find the payment in the list or in the "Day book" part of the register.
3. Click the receipt number (or the print button on the row).
4. A receipt opens. Print it.

> 💡 The day book can be searched by receipt, month, mode or amount. Choose "This session" or "All time".

#### 9.4 Print or send a dues notice

1. Open the student in "📒 Register book".
2. Press "📄 Dues notice" to print a dues notice.
3. Or press "📋 Copy reminder" to copy the reminder text and paste it into a message.
4. If the "📲 WhatsApp reminder" button is shown, press it to send to the parent phone number on file.

> 💡 If the student has no parent phone on file, the WhatsApp button will not work. Add the phone number in Students.

#### 9.5 Print a day book for the fee desk

1. Open the "📅 Fee Day Book" tab.
2. Pick Today, Yesterday, This week, This month or Last month. Or set From and To dates.
3. Use Mode or Search to narrow the list.
4. Press "🖨️ Print day book".

#### 9.6 See who has dues this month

1. Open the "🗓 Monthly Fee Ledger" tab.
2. In "Show" choose "With dues" or "Fully paid".
3. In "Sort" choose "Highest due" to see the biggest dues first.
4. Use "Students" to include inactive students if needed.
5. Press "🖨️ Print register" to print.

#### 9.7 Print every ledger or export to Excel

1. For all students, press "🖨️ Print all ledgers" next to the search box.
2. For one student, open the student and press "⬇️ Excel" or "🖨️ Print register".

**Good habits**

- "🔗 Copy ledger link" copies a link to this student's ledger that you can share with other staff.
- This module only shows data. To fix a wrong payment, use the Fees module.
- Check the hostel type note on the register if the fee looks different from the usual amount.

**Common mistakes**

- Looking for a button to add or edit a payment → Not possible here. Use Fees.
- Student not found → Try the GCC No. or Adm. No. instead of the name, and check the spelling.
- Wrong session shown → Press the correct "Session ..." button at the top of the register.

**Questions people ask**

- **Why do I not see the Expenditure Day Book tab?** It is shown only to staff who can open the Accounts module.
- **What do Paid, Advance, Short and Due mean?** Paid: month fully paid. Advance: paid ahead of time. Short: paid but less than the fee. Due: not paid yet. Upcoming: month not yet started.
- **Can I delete a payment here?** No. This screen is read-only.

### 10. Fee Setup

_Used by: Admin_

Where the Admin sets how much each course, batch and hostel type pays. It also lets the Admin give one student a special monthly flat fee. Other staff cannot open this module.

**Before you start**

- Only Admin can open Fee Setup. Other roles see "Access Denied".
- Decide the amounts for the session first: Flat Fee, Course Fee and Admission Fee for every batch and hostel type.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📋 Fee Structures | Enter Flat Fee per month, Course Fee per month and Admission Fee for each course, batch and hostel type, for one session. |
| ✏️ Student Overrides | Give one student a different monthly flat fee for a session, with a reason. |

**How to…**

#### 10.1 Set the fees for a session

1. Open Fee Setup. The "📋 Fee Structures" tab opens.
2. Under "Session:" press the session you want, for example 2026-2027.
3. Press a course tab: Sainik, Navodaya, Foundation or Combined Course.
4. For each batch and hostel type (Boarder, Day Boarder, Day Scholar), type the Flat Fee /mo, Course Fee /mo and Admission Fee.
5. Changed rows show "EDITED".
6. Press "💾 Save ... change(s)" at the top. When it shows "✓ Saved", it is done.

> 💡 Flat fee is the monthly hostel/facility fee. Course fee is the monthly tuition fee. Changes apply to the chosen session only.

#### 10.2 Copy last session's fees to a new session

1. Choose the new session under "Session:".
2. Press "📋 Copy from prev session".
3. Read the message. It lists any combinations that had nothing to copy. Fill those by hand.
4. Change any amounts that are different this year.
5. Press "💾 Save ... change(s)". The copy is not saved until you press this.

#### 10.3 Fix the "not configured" warning

1. If you see "⚠️ ... not configured" at the top, some combinations have no saved fee.
2. Students in these groups are billed from the old built-in amounts. The ₹0 values on screen are only placeholders.
3. Press the course button shown in the warning to jump to that course.
4. Enter the real amounts and press Save.

> 💡 Rows that say "N students on old rates" have active students waiting for a saved fee.

#### 10.4 Give one student a special flat fee

1. Open the "✏️ Student Overrides" tab.
2. Choose the session at the top.
3. Type the student name or GCC number and press "🔍 Search". Only active students are found.
4. Click the student in the list.
5. You will see the normal flat fee. Type the "New Flat Fee Override (₹/month)".
6. Type a Reason, for example scholarship (optional).
7. Press "✅ Set Override".

> 💡 The amount must be 0 or more. An override changes only the monthly flat fee for that session.

#### 10.5 Change or remove an override

1. Under "Active Overrides", press "↻ Refresh" to see the current list for the session.
2. Open the student from the list.
3. To change it, type the new amount and press "✏️ Update Override".
4. To remove it, press "🗑 Remove" and confirm. The student goes back to the standard rate.

**Good habits**

- Check the session shown under "Session:" before you type any amount.
- If a save fails, your edits stay on the screen. Check you are signed in as Admin and try again.
- Fee changes affect new dues. Check the Student Fee Ledger after a big change.

**Common mistakes**

- Editing the wrong session → Always check the Session button first.
- Pressing "Copy from prev session" and leaving → It does not save. Press Save.
- Leaving ₹0 in unset rows → Those students are billed on old amounts. Enter the real fee.
- Using an override for the whole batch → Overrides are for one student only. Change the Fee Structure instead.

**Questions people ask**

- **Why can I not open Fee Setup?** It is for Admin only.
- **What is the default Admission Fee shown on a new row?** A new row starts with 6000 as a placeholder. It is not saved until you press Save, so enter the real amount.
- **Can I give a discount on course fee for one student?** The override screen changes only the monthly flat fee.

### 11. Construction & Maintenance

_Used by: Admin, Accountant_

Track campus building projects and repair work: budget, payments to contractors, milestones, photos, issues, site diary and regular upkeep tasks. It is kept separate from the main Accounts ledger.

**Before you start**

- Know the project name, budget and contractor before you create a project.
- Keep contractor bills or payment slips ready. You can attach a photo or file to each payment.
- If the Maintenance tab or some fields (Location, Retention) are missing, the extra database setup has not been done. Ask the Admin or developer.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📊 Dashboard | Overview: monthly cash flow, projects by status, payments due in the next 30 days, category spend, top contractors, recent activity and alerts such as over budget. |
| 🏗️ Projects | All projects as Cards, Board or Table, with search and filters. Click a project to open it. |
| 🗓️ Timeline | A bar chart of planned start to target date for each project, with milestones marked. |
| 🔧 Maintenance | Regular upkeep tasks (like water tank cleaning) that repeat after a number of days. A number on the tab shows tasks that are due. |
| 👷 Contractors | List of contractors with their projects. Add or edit contractor details. |

**How to…**

#### 11.1 Create a new project

1. Press "+ New project" at the top.
2. Choose the category: Construction or Maintenance.
3. Type the Project name. It is required.
4. Choose Status (Planned, Ongoing, Completed, On Hold or Cancelled) and Priority (Low, Medium, High or Critical).
5. Type the Budget (₹), Contractor / vendor, Contractor phone, Start date and Target end date.
6. Add a Description or Notes if needed.
7. Press "✓ Create project".

#### 11.2 Record a payment to a contractor

1. Open the project and go to the "Payments" tab.
2. Press "+ Record payment".
3. Type the Amount (₹). It is required. Check the Date.
4. Choose the Mode (Cash, Bank, UPI or Card). For non-cash, type the Txn ref (UTR or cheque number).
5. Fill Paid by and Received by (contractor side).
6. Attach a Receipt / photo and add Notes if you have them.
7. Press "✓ Save payment".
8. Press the 🧾 button on a payment to print the payment voucher.

> 💡 If the total paid goes above the budget, a warning shows how much the project is over budget.

#### 11.3 Update progress and status

1. Open the project. In the "Overview" tab, move the progress slider.
2. To change the status, press one of the status buttons (Planned, Ongoing, Completed, On Hold, Cancelled).
3. Press "✏️ Edit" to change budget, dates, contractor or notes, then "✓ Save changes".

#### 11.4 Add milestones

1. Open the project and go to the "Milestones" tab.
2. Press "+ Add milestone".
3. Type the Milestone name, for example "Foundation complete", and fill the other fields.
4. Save it.
5. When the milestone payment is made, press the round tick button on that row to mark it paid.

#### 11.5 Add photos, issues and site diary entries

1. Photos tab: choose the Stage (Before, During or After), add a Caption if you want, and upload the photo.
2. Issues tab: press "+ Report issue", type the Issue, Priority, Assigned to and Fix by, and save.
3. Site diary tab: press "+ Today's site entry", fill Date, Weather, Workers on site and "Work done today" (required), then save.

> 💡 Take a Before photo at the start and an After photo at the end. It makes the project report better.

#### 11.6 Plan regular maintenance

1. Open the "🔧 Maintenance" tab and press "+ Schedule task".
2. Pick a ready-made task (for example Water tank, Generator, CCTV) or type your own Asset and Task.
3. Set "Repeat every (days)" and save.
4. When the work is done, press "✓ Mark done" on the task.
5. Use "Pause" to stop a task for a while and "Resume" to start it again.

#### 11.7 Print a report or export

1. For all projects, press "📄 Portfolio PDF" at the top.
2. In the Projects tab, press "⬇ Excel/CSV" to download the list.
3. For one project, open it and press "📄 PDF report".

**Good habits**

- Use the Dashboard alerts every week: over budget, heading over budget and payments due.
- The "⧉ Duplicate" button on a project copies it, useful for similar jobs.
- In Projects you can switch between Cards, Board and Table. The Board lets you drag a card to change its status.
- Record every payment on the same day, so the balance is correct.

**Common mistakes**

- Deleting a project to fix a mistake → Deleting removes the project and all its payments, milestones, photos and issues. It cannot be undone. Edit the project instead.
- Forgetting the contractor payment in this module → Payments here are kept separate from the main Accounts ledger. Record them here so the project balance is right.
- Leaving the status as Ongoing after the work ends → Open the project and set it to Completed.

**Questions people ask**

- **Do payments here appear in Accounts?** No. This module says it is kept separate from the main accounts ledger.
- **Can I delete a wrong payment?** Yes. In the Payments tab press the ✕ button on that payment and confirm. This cannot be undone.
- **What is retention?** Retention % is an amount held back from the contractor until the work is complete. It appears only if the extra setup is done. When the project is Completed you can record the retention payment from the Overview tab.

### Academic

### 12. Attendance

_Used by: Teacher, Housemaster, Admin, Reception_

Mark daily student attendance by class session, see sessions, reports and dashboards, manage the student list (Student DB), student leave requests and the monthly attendance award.

**Before you start**

- Students must be in the Student DB with the right Course and Batch. Only active students appear in the roll call.
- It helps if the batch has a timetable (Timetable module), because Subject and Teacher can then fill in from the Period.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Overview | Quick numbers: students enrolled, average attendance, high risk and on track. |
| Student DB | The student list: add, edit, mark as dropout, delete, import from CSV. Views: Active, Dropout, Trash (Trash is Admin only). |
| Student 360 | For each student: attendance, discipline, fees and hostel status in one view. Has "Export CSV". |
| Mark | Take attendance for a class session. |
| Sessions | All recorded attendance sessions. Filter by date and course, open one, or delete it. |
| Dashboard | Charts: attendance by course over time, weekday pattern, status split, longest streaks and who needs attention. Choose the last 3, 6 or 12 months. |
| Reports | Sub-tabs Monthly, Batch trend, Heatmap, By subject and Staff log. Print or Export CSV. |
| Leaves | Student leave requests. Sub-tabs Pending, Approved, Rejected and "+ Apply". |
| Awards | Best Student of the Month, ranked by attendance percentage. |

**How to…**

#### 12.1 Take attendance for a class

1. Open Attendance and click "Mark".
2. Choose the "Course" (required) and the "Batch". "Class" is optional (for example 9A).
3. Choose the "Date". It shows today by default.
4. Choose the "Period". If the timetable has it, Subject and Teacher fill in automatically. You can also choose them yourself.
5. Everyone starts as Present. Change the status of absent, late or leave students. The statuses are Present, Absent, Late and Leave.
6. Use the search box (name or GCC number) to find a student quickly.
7. Click "Save attendance · N students".
8. After saving, a success box appears and a WhatsApp report panel opens. If there are absent students, a panel to message parents also opens.

> 💡 Each Save creates a new session. Do not save the same class twice.

#### 12.2 Mark fast with GCC number

1. In "Mark", find the box "⚡ Quick mark — scan or type GCC number, press Enter".
2. Type or scan the GCC number and press Enter.
3. The student is marked Present and you see "marked Present". If the number is not found you see "No student found for GCC ...".

> 💡 A barcode scanner works here because it types the number and presses Enter.

#### 12.3 Copy last session or flip everyone

1. Choose a Course first.
2. Click "Copy last" to copy the records of the last session for that course.
3. Click "Invert" (on large screens) to flip Present to Absent and the others to Present.
4. Fix any students who need a different status, then Save.

#### 12.4 Check or delete a recorded session

1. Click "Sessions".
2. Use the date and course filters. Click "Clear filters" to reset.
3. Click a session to see its records.
4. To remove it click the delete icon, then "Delete" in the question "Delete this session and all its records permanently?". This cannot be undone.

#### 12.5 Get a monthly report

1. Click "Reports".
2. Choose a sub-tab: Monthly, Batch trend, Heatmap, By subject or Staff log.
3. Choose the month and the course ("All courses" is allowed).
4. Click "🖨️ Print" or "⬇️ Export CSV".

> 💡 In the monthly report the colour bands are Good 75% and above, Low 50 to 74%, Risk below 50%.

#### 12.6 Add a student or change a student

1. Click "Student DB". The tabs are "👥 Active", "🚪 Dropout" and (Admin only) "🗑 Trash".
2. Click "+ Add Student". Name is required. Choose Course and Batch. GCC No. must be a number.
3. Fill Parent Contact No. and Hostel Type, then save.
4. To change a student click "✏️ Edit".
5. To stop a student from appearing in roll call, mark them as Dropout and click "⚠️ Confirm Dropout". They can come back with "↩️ Reactivate".
6. Admin can use "⬆️ Import CSV". The file must have a "name" column.

> 💡 Parent phone numbers are hidden from staff who are not Admin.

#### 12.7 Apply for and approve student leave

1. Click "Leaves", then "+ Apply".
2. Fill Student name, From, To and Reason. Course and Batch are optional. All four main fields are required.
3. Submit. The request shows in "Pending".
4. Admin opens "Pending" and clicks Approve or Reject.

#### 12.8 Finalize the Best Student of the Month (Admin)

1. Click "Awards". The ranking is by attendance percentage.
2. Admin clicks "Finalize" to save the award for a course or overall.
3. A certificate can be viewed after the award is saved.

> 💡 Staff who are not Admin can only look at the ranking.

**Good habits**

- Mark attendance first, because Teaching logs cannot be saved until attendance is marked for that batch and date.
- On a phone, the bottom bar shows the main five pages. The rest are under "More".
- Add a Remarks note on the Mark page for special days.

**Common mistakes**

- Saving the roll call without checking the date → check the Date field before saving.
- Saving the same class twice → open Sessions and delete the wrong session.
- Choosing the wrong Batch → students of other batches will not show. Choose the correct Batch.
- Deleting a student who left → mark them as Dropout instead, so their history stays.

**Questions people ask**

- **Why is a student missing from the Mark list?** Dropout students and deleted students are not shown. Also check the Course and Batch of the student in Student DB.
- **Who can permanently delete a student?** Only Admin ("🗑 Delete Forever" in Trash). Other staff can only move a student to trash.
- **What do the risk labels mean?** The Overview and Student 360 use High risk, Watch and On track. They come from attendance, open discipline cases, overdue fees and hostel status.
- **Can I undo a saved attendance?** The Mark page only creates new sessions. If a session was wrong, delete it in Sessions and mark the class again.

### 13. Exams

_Used by: Admin, Accountant, Teacher_

The Exam HUB: set up exam types and schedules, enter marks, see results and rankings, and print admit cards and report cards. The tabs you see depend on your permissions.

**Before you start**

- The batches (Achiever, Champion and so on) and their subjects must be listed in "Course Subjects".
- The exam type must exist in "Exam Types".
- The exam must be added in "Schedule" first. Mark Entry takes its subjects and total marks from the Schedule.
- Students must be added in StudentDB (inside Attendance, Students tab). They then appear here by themselves.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Entry > Mark Entry | Type marks for each student and subject, or import them from Excel. |
| Entry > CSV Import | Smart CSV / Excel import of marks. It matches students by name or GCC and can be rolled back. |
| Results > Marks Grid | View all saved marks in one grid. |
| Results > Analytics | Charts and class analysis. |
| Results > Rankings | Top performers. |
| Results > Progress | Progress of one student across exams. |
| Results > Compare | Side-by-side comparison. |
| Results > Merit List | Generate merit lists (printable). |
| Results > Dashboard | Exam HUB overview. |
| Results > Mock Analyzer | Analysis of mock tests. Upload Excel result sheets, save the records, print reports. Sub-tabs: Overview, Student Analyser, Subject Analysis, Batch / Test Report, Upload & Data. |
| Documents > Admit Cards | Make admit cards for a batch and print one at a time. |
| Documents > Report Cards | Print report cards. |
| Documents > Bulk Reports | Print many report cards or admit cards together ("Print Queue"). |
| Documents > Certificates | Print topper certificates. |
| Schedule > Schedule | The exam timetable: subject, date, time, shift, room, total marks. |
| Schedule > Seat Arrangement | Assign seats and rooms by dragging students. |
| Setup > Students | List of exam students. Adding and editing students is done in StudentDB, not here. |
| Setup > Course Subjects | Subjects for each course / batch. You can add, rename or delete a course. |
| Setup > Exam Types | Create and delete exam types such as "1st Monthly Test". |
| Setup > Exam Config | Switch exam mark schemes. Build a new exam format. |
| Setup > Settings | Institute name, address, tagline, principal, class teacher, logo URL and academic year that appear on printouts. |

**How to…**

#### 13.1 Create an exam type

1. Open Exams, click "Setup", then "Exam Types".
2. Under "➕ Add Exam Type" type the "Name" (for example 1st Monthly Test). Description is optional.
3. Click "Add Type".
4. A green message may offer "🔗 Set up its schedule now". Click it to go to Exam Config with the name filled in.

> 💡 A name that already exists is refused, because two types with one name cause confusion in reports.

#### 13.2 Put the exam on the Schedule

1. Click "Schedule", then "Schedule" again.
2. Choose a mode: "Single Entry", "Multi-Subject", "One Subject → Many Courses", "From Active Config (All Batches)", "Auto-Generate Timetable", "Import CSV/Excel" or "Duplicate Entries".
3. In Single Entry choose Exam Type, Course, Subject, Date, Time, Shift, Room and Total Marks. Click "Add Entry".
4. For many rows at once use "Import CSV/Excel". Click "📋 Download Template", fill it, click "📂 Upload File", check the preview, then click "💾 Confirm Import".
5. To delete a row, use its delete button and confirm "Delete this entry?".

> 💡 Import columns are: course, subject, date, type, time, shift, room, marks.

#### 13.3 Enter marks by hand

1. Click "Entry", then "Mark Entry".
2. Choose the "Course" (batch), the "Exam Type" and the "Exam Date".
3. Type marks for each student and subject. A mark above the subject maximum is cut down to the maximum.
4. For a student who did not sit a paper, press the small "A" button (shows "ABS"). The mark is set to 0.
5. To give one subject the same mark for everyone, use the bulk-fill box for that subject and confirm.
6. Click "Save Marks".

> 💡 If you change course, exam type or date with unsaved marks, a message warns that they will be lost. Save first.

#### 13.4 Import marks from Excel or CSV

1. Click "Entry", then "CSV Import".
2. Drop the CSV or Excel file where it says "Drop CSV or Excel here", or click to choose a file.
3. Check the preview: matched students, unmatched students and subject columns.
4. Fix anything wrong, then confirm the import. You see "✅ Import complete".
5. If the import was wrong, use the "↩ Rollback available" option to undo it.

> 💡 If no exam is scheduled for that batch and date, you get a message to create the schedule first.

#### 13.5 Print admit cards

1. Click "Documents", then "Admit Cards".
2. Choose the Course and the Exam Type. You can also search by name or GCC.
3. If the schedule is empty, a warning shows. Go to Schedule and add the entries.
4. Click the 🖨️ button on a student to print their card.
5. For many students at once, use "Bulk Reports" and its "Bulk Admit Cards" option.

> 💡 Students with status Dropout do not get admit cards.

#### 13.6 Print report cards

1. Click "Documents", then "Report Cards".
2. Choose the batch and Exam Type (a secondary batch filter is also there).
3. Print for one student, or open "Bulk Reports" to build a "Print Queue".
4. In Bulk Reports you can filter students, sort, and choose "Include teacher remarks" and "Page break between cards".
5. If a popup is blocked, allow popups for this site.

#### 13.7 Seat arrangement

1. Click "Schedule", then "Seat Arrangement".
2. Choose the Exam Type and date, then pick a room or add one ("New room…").
3. Drag students to seats ("Drop here"). Click a seat to remove the student.
4. Click Save. "🗑️ Clear" empties the room.

#### 13.8 Set the name and address for printouts

1. Click "Setup", then "Settings".
2. Edit Institute Name, Address, Tagline, Principal Name, Class Teacher, Logo URL and Academic Year.
3. Click "Save Settings".

**Good habits**

- Right order: Course Subjects, Exam Types, Schedule, Mark Entry, then Results and Documents.
- Accountant and Manager roles can always reach Mark Entry, Schedule, Seat Arrangement and Setup screens.
- On a phone, tabs open from a Home screen and a bottom bar.
- Only Admin can delete in most places. Other roles may be allowed to edit and import depending on permissions.

**Common mistakes**

- Entering marks before the Schedule exists → add the exam in Schedule first, or Mark Entry shows "No exam scheduled".
- Making two exam types with the same name → use one name only.
- Switching course or date before saving → marks typed but not saved are lost.
- Deleting an exam type → cannot be undone. Use "🔍 Inspect" first to see if marks exist for it.
- Renaming or deleting a course in Course Subjects without checking → it changes the saved settings used by many screens.

**Questions people ask**

- **Why can I not see all tabs?** Tabs depend on your permissions. Setup tabs need edit permission. Ask an Admin.
- **Where do I add a new student?** In StudentDB, inside Attendance (Students tab). The student then shows here automatically.
- **Why is a student missing from Mark Entry?** Students marked Dropout are left out of Mark Entry and Admit Cards. Their old marks stay in the results.
- **What is a secondary batch?** A second batch tag on a student. The student appears once under the real batch and once more under the secondary batch for exam screens.

### 14. Timetable

_Used by: Admin, Teacher, Any staff_

The weekly Monday to Saturday class timetable for every batch, with a log for one-day substitute teachers and printable reports.

**Before you start**

- An Admin must load the timetable first (Setup tab). If it is empty you will see "No timetable loaded yet".
- Staff names must exist in the Staff module so they appear in the teacher lists.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Timetable | The weekly grid. Choose "All Batches" or one batch to see periods, subjects and teachers for Monday to Saturday. |
| Substitute Entry | Record that another teacher takes a class on one particular date. |
| Reports | Make a print-ready Batch Timetable, Master Timetable or Substitute Log. |
| Setup | Admin only. Load the standard Monday to Saturday schedule. |

**How to…**

#### 14.1 See the timetable of a batch

1. Open Timetable. The "Timetable" tab opens first.
2. Click "All Batches" to see every batch, or click one batch name to see only that batch.
3. Read across a row for the period and down a column for the day.
4. Break rows are shown as dark bars. If a substitute is recorded for today, the old teacher is crossed out and the new teacher is shown with an arrow.

> 💡 Substitute names show on the grid only for today. They do not change the weekly timetable.

#### 14.2 Record a substitute teacher

1. Click the "Substitute Entry" tab.
2. Pick the "Date". The day name is shown under it.
3. Choose the "Batch".
4. Choose the "Period". Only periods that the batch has on that day are listed. If you see "No classes on ...", pick another date or batch.
5. "Original Teacher" fills in by itself (grey box).
6. Choose the "Substitute Teacher" from the list.
7. Optional: type a "Reason" (for example leave or official duty).
8. Click "+ Record Substitute". A "Substitute recorded" message appears.

> 💡 Date, Batch, Period and Substitute Teacher are required.

#### 14.3 Check or remove a substitute

1. In "Substitute Entry", set the date. The table "Substitutes for ..." shows records for that date.
2. Only Admin sees the 🗑 button. Click it to remove a record. It is removed at once.

#### 14.4 Print a timetable or substitute report

1. Open the "Reports" tab.
2. Pick one: "Batch Timetable", "Master Timetable" or "Substitute Log".
3. For Batch Timetable choose the Batch. For Substitute Log choose the "From" and "To" dates.
4. Click "🖨 Generate & Print Report". A new window opens with the school letterhead.
5. In the print window choose a printer, or choose "Save as PDF".

> 💡 Allow pop-ups in your browser if the print window does not open.

#### 14.5 Change one slot (Admin only)

1. In the "Timetable" tab, click the slot (subject box) you want to change. Only Admin can click slots.
2. Change "Subject", "Teacher" or "Room".
3. Click "Save". Or click "Cancel" to close without changes.
4. To remove the slot click the 🗑 button and confirm "Delete this slot?".

> 💡 This changes the weekly timetable for every week, not just one day. For a one-day change use Substitute Entry.

#### 14.6 Load the standard schedule (Admin only)

1. Click the "Setup" tab.
2. Read the warning. This clears the full weekly grid and reloads it.
3. Click "Load Standard Mon–Sat Schedule" and confirm.
4. Wait for the "Loaded ... slots" message.

> 💡 All your manual slot edits are lost when you do this. Substitute records are not affected.

**Good habits**

- Use a Substitute Entry for one-day changes. Edit the slot only for permanent changes.
- Teachers can open the Timetable tab to check their own periods.
- Use the Master Timetable report to put one full page on the notice board.

**Common mistakes**

- Editing a slot to cover one absent teacher → use Substitute Entry so the weekly timetable stays correct.
- Pressing "Load Standard Mon–Sat Schedule" to fix one slot → this replaces the whole grid. Edit the single slot instead.
- Choosing a Sunday or a day with no classes for a substitute → the Period list will be empty. Pick the correct date.

**Questions people ask**

- **Why can I not click on a slot?** Only Admin can edit slots. Ask an Admin.
- **Why is the Setup tab missing?** It is shown to Admin only.
- **Does a substitute change next week?** No. A substitute is for the chosen date only.

### 15. Teaching

_Used by: Teacher, Housemaster, Admin_

The place where teachers write a daily teaching log after each class, and where class test scores, the teaching calendar, monthly reports and the study-material tools are kept. Tabs you see depend on your role.

**Before you start**

- Attendance for the batch must be marked for that date before you can save a teaching log.
- Courses and batches must exist in the Courses module.
- You must be on the school campus (GPS is checked) to save a teaching log.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Daily Logs | Add and view teaching logs: who taught what, in which period. |
| Chapter Hub | Opens the Chapter Hub. It links chapters with study material and questions. |
| Material Studio | Opens Material Studio for making study material. |
| Study Materials | Opens the Study Materials library inside Teaching. |
| Question Bank | Opens the Question Bank. Teachers can edit, only admins can delete. |
| Study Lockers | Opens Study Lockers inside Teaching. |
| Calendar | A month calendar of logged classes and missed classes, with subject and teacher filters. |
| Syllabus | Syllabus progress by batch and subject. |
| Reports | Monthly report: classes taken, missed classes, subjects covered and active teachers. Print option included. |
| Class Test Scores | Enter and review student class test marks. |
| HM Dashboard | For housemasters and admin: open doubt sessions, teacher warnings and student score alerts. |
| Attendance | The student Attendance screen, opened inside Teaching. |
| Geo Check-In | Staff location check-in. |
| Report Cards | Report cards for students. |
| Syllabus Manager | Admin and manager only. Manage the syllabus. |

**How to…**

#### 15.1 Write a teaching log after class

1. Open Teaching. The "Daily Logs" tab shows first.
2. Click "➕ Add Log".
3. Choose Course, Batch / Subtype, Class and Subject.
4. Choose the "Teaching Date" and the "Period". Periods that have not started yet show a lock 🔒 and cannot be chosen.
5. Choose the Chapter and the Sub-topic / Lesson (or type them if not in the list).
6. Fill "Covered From" and "Covered To" (question number, page or topic).
7. Write "Topic Taught (summary)". Classwork, homework and remarks are optional.
8. Choose the teaching technique and write the "Notes for HM". These are required.
9. Click "✅ Save Log". Read the review box and confirm "Save Log".

> 💡 Fields marked * are required. If one is missing you see "Please fill in all required fields".

#### 15.2 If the log is refused

1. Duplicate message: a log for the same subject, date and batch already exists. Edit the old one instead.
2. Attendance message: mark attendance for that batch and date first, then save again.
3. Location message: you are more than 150 m from campus, or location is blocked. Go to campus and allow location in your browser.
4. Repeated content: if many logs repeat the same content, you get a warning and then a block.

#### 15.3 Ask for a doubt session while logging

1. In the log form, switch on "Needs Doubt Session?".
2. Add the practice questions (paste them from a PDF or book).
3. Choose the Housemaster / Warden under "Assign Housemaster / Warden".
4. Choose the "Preferred Date for Doubt Session" and "Preferred Time Slot".
5. Write the "Instruction Message to HM". If students are listed, select the students who need attention.
6. Save the log. All of these are required once the doubt session is on.

#### 15.4 Find, edit or print a log

1. In "Daily Logs" use the search box, the course and subject filters, and the From and To dates.
2. Click "CSV" to download or "Print" to print the list. Click "✕ Clear" to remove filters.
3. On a log card click "Edit" to change it, or "Print" to print that log.
4. Only Admin sees "🗑 Delete". Delete cannot be undone.

#### 15.5 Enter class test scores (one student)

1. Open the "Class Test Scores" tab and click "➕ Add Score".
2. Choose Course, Batch / Subtype, Class and Student.
3. Choose Subject, type the "Topic / Test Name" and the "Test Date".
4. Type the "Score" and "Out of". Score cannot be negative or more than Out of.
5. Click "✅ Save Score".

> 💡 A second score for the same student, subject, topic and date is refused. Edit the old one.

#### 15.6 Enter class test scores for a whole class

1. In "Class Test Scores" click "Bulk entry".
2. Choose Course, Batch / Subtype, Class, Subject. Type the "Test / Topic Name", "Test Date" and "Max Marks".
3. Load the students (the button under the form), then type each student's marks.
4. Click the "Save ... Scores" button. Students who already have this test are refused.

#### 15.7 Check the month at a glance

1. Open "Calendar" to see which days have logs and missed classes. Filter by subject or teacher.
2. Open "Reports" for the monthly numbers. Click "🖨️ Print" to print.
3. Open "HM Dashboard" to see open doubt sessions and teacher warnings (housemasters and admin).

**Good habits**

- Save your log right after the class. The period unlocks about 5 minutes before it starts.
- The tab you used last is remembered next time you open Teaching.
- Daily Logs shows a number on the tab for logs saved today.
- Use CSV on Daily Logs and Class Test Scores to open data in Excel.

**Common mistakes**

- Saving a log without marking attendance first → mark attendance, then save.
- Copying the same text into many logs → this triggers warnings. Write what you really taught.
- Trying to save from home → logs can only be saved on campus.
- Entering the same test twice → edit the existing score.

**Questions people ask**

- **Why can I not pick a period?** That period has not started yet. It unlocks 5 minutes before its start time.
- **Why do I not see some tabs?** Tabs depend on your role. For example Reports is for Admin, Manager and Accounts, and Syllabus Manager is for Admin and Manager.
- **Who can delete a log?** Only Admin.
- **I see "No Teaching sections for your role".** Your role has no access. Ask an administrator.

### 16. Courses

_Used by: Admin, Any staff_

The master list of courses, batches, student enrollments and course fee amounts. Other modules use these batches, so keep them correct. Only Admin can add, edit or delete; other staff can only view.

**Before you start**

- Students should already be admitted in the Students module (you pick them by name or GCC number when enrolling).
- Create the Batch first, then enroll students into it.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Overview | Totals for courses, batches, enrollments and active students, with a count by hostel type. |
| Batches | Create and manage course batches. This is the single source of truth for batches. |
| Enrollments | See and manage which student is in which batch. |
| Fees | Fee structure per course, subtype and hostel type. |

**How to…**

#### 16.1 Add a new batch

1. Open Courses and click the "Batches" tab.
2. Click "+ Add" (only Admin sees this button).
3. Type the "Batch Name" (for example: Sainik Achiever Boarder 2025-26). It is required.
4. Choose the "Course". It is required.
5. Fill Subtype, Class Name, Hostel Type and Session Year as needed.
6. Fill Teacher, Room, Start Time, End Time, Start Date, End Date and Capacity if you know them.
7. Set "Status": Active, Upcoming, Completed or Cancelled.
8. Tap the "Class Days" buttons (Mon to Sun) for the days the class runs.
9. Click "Add Batch".

> 💡 If Batch Name or Course is empty, the screen shows "Batch name and course required."

#### 16.2 Edit or delete a batch

1. In the "Batches" tab, you can filter the list by session year and by course.
2. Click "Edit" on the batch, change the fields, then click "Update".
3. To remove a batch, click the bin button and confirm "Delete batch?".

> 💡 Deleting cannot be undone. If a batch is only finished, change its Status to Completed instead.

#### 16.3 Enroll a student in a batch

1. Open the "Enrollments" tab and click "+ Enroll".
2. Use the student search box at the top to pick the student. Name, GCC No., course, class and hostel type fill in automatically and "Student linked" appears.
3. Check "Course", "Subtype", "Class Name" and "Hostel Type".
4. Choose the "Batch (filtered)". The list only shows batches of that course and hostel type.
5. Check Session Year and Enrolled Date. Set Status: Active, Completed, Dropped or On Hold.
6. Add Notes if needed, then click "Enroll".

> 💡 Student Name and Course are required.

#### 16.4 Handle the duplicate enrollment warning

1. If the student already has an Active enrollment, a message warns that saving will create a SECOND active enrollment.
2. Click Cancel unless you really want two. It is better to edit the old enrollment instead.
3. If the hostel type you picked is different from the hostel type in the student record, you get another warning.
4. If the hostel type really changed, update it on the Students page first, then come back.

#### 16.5 Find or change an enrollment

1. In "Enrollments", filter by course and by hostel type (Boarder, Day Boarder, Day Scholar).
2. Type a name or GCC number in the search box.
3. Click "Edit" to change it, or the ✕ button to remove it (you must confirm "Remove enrollment?").

#### 16.6 Add a course fee amount

1. Open the "Fees" tab and click "+ Add Fee".
2. Choose the "Course" and, if needed, the Subtype and Hostel Type. Leave them empty to mean "All".
3. Choose "Fee Type": Monthly, Quarterly, Half-Yearly, Annual or One-Time.
4. Type the "Amount (₹)". Course and Amount are required.
5. Optionally fill Due Day (1 to 31), Discount (%), Session Year and Notes.
6. Click "Add Fee". Use "Edit" or ✕ on a fee card to change or delete it.

> 💡 Fees are shown in cards grouped by course, subtype and hostel type.

**Good habits**

- Only Admin, Administrator and Co-Admin can add, edit or delete. Everyone else can only look.
- Use the Overview tab for a quick count of batches and active students.
- Always give the batch a clear name with course, hostel type and year.

**Common mistakes**

- Creating a second Active enrollment for the same student → edit the existing enrollment instead.
- Choosing a different hostel type here than in the student record → fix the Students record first.
- Deleting a batch that is still in use → change its Status instead.

**Questions people ask**

- **Why can I not see the "+ Add" or "Edit" buttons?** Only Admin-type roles can change Courses data. Ask an Admin.
- **Why is my batch missing in the Enroll form?** The batch list is filtered by the Course and Hostel Type you picked. Check both, or check the batch hostel type.
- **What does Due Day mean in Fees?** The day of the month on which that fee is due, from 1 to 31.

### 17. Learning Hub

_Used by: Admin, Teacher_

One place for all academic content: study materials, teaching aids, the question bank and the entrance exam. The flow is Learn, then Practice, then Assess.

**Before you start**

- You only see a tab if your role has permission for it (Admin sets this in Permissions).
- Add Subject, Delete, Create Paper, Online Test, Smart PPT and Stats are for Admin only.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Study Materials | Notes, formula sheets, practice sets, solved papers, mind maps, videos and current affairs, arranged by course, subject and chapter. |
| Teaching Aids | A bookshelf of teaching books (batches like Lakshya and Umeed). Students read them page by page in a view-only reader. |
| Question Bank | Add, edit and organise questions. Admin can also make papers, online tests, slides and see stats. |
| Question Bank Viewer | A read-only view of the questions by course, subject and chapter. You can print a chapter with or without answers. |
| Entrance Exam | Runs a whole entrance exam: set-up, applications, question paper, hall tickets, exam day, evaluation, results and admission. |

**How to…**

#### 17.1 Find a chapter in Study Materials

1. Open Learning Hub and click the "Study Materials" tab.
2. Choose a course button: Sainik School, Navodaya Vidyalaya, Foundation Course or Rashtriya Military School.
3. Stay on the "Library" view and pick a subject on the left.
4. Open the chapter. Its materials are listed with a type badge (Notes PDF, Formula Sheet, Practice Set, Solved Paper, Mind Map, Video Link, Current Affairs).
5. Use the search box to find a material by name.

> 💡 Staff who are not Admin see "View Only" for PDF and document files. Download is allowed for Admin only.

#### 17.2 Add materials to a chapter (paste links)

1. In a chapter, click "+ Add" (or "📋 Paste now" if the chapter is empty).
2. Type or paste one item per line: a title, then a Drive or YouTube link.
3. Click "🔍 Detect Items". The page guesses the type (notes, video, and so on).
4. Check the list. Untick any line you do not want.
5. Click save. A message shows how many materials were saved.

> 💡 If a title contains a chapter name, the page puts it in that chapter for you.

#### 17.3 Delete a material or add a subject or chapter (Admin only)

1. To delete: click "🗑 Delete" on the material card and confirm. The file is removed and this cannot be undone.
2. To add a subject: click "Add Subject", type the subject name, choose an icon and save.
3. To add a chapter: use the "New chapter name…" box at the bottom of the subject.
4. Custom subjects and chapters show a "custom" badge. "🗑 Delete subject" removes only the subject; the materials are kept.

#### 17.4 Rate and save a material

1. On a material card, click the stars to give your rating.
2. Click "🔖 Save" to keep it on your shelf.
3. Open the "Saved" view to see your saved materials.

> 💡 The Saved view only shows when the database supports it.

#### 17.5 Read a Teaching Aid

1. Open the "Teaching Aids" tab.
2. Click a batch button (for example Lakshya, Umeed or Combined Course).
3. Use the subject chips such as "All Subjects" to narrow the shelf.
4. Click a book cover to open it. Your last page is remembered.
5. In the reader you can bookmark a page, draw a highlight box, write a page note, change text size (A− / A+), and use night mode.
6. "📺 Cast" sends the book to a TV that supports it.

> 💡 The reader blocks download and print, but nothing can fully stop a phone photo.

#### 17.6 Upload a Teaching Aid (Admin only)

1. In "Teaching Aids" click "➕ Add Teaching Aid".
2. Choose the Batch and type the Title (both required).
3. Fill Subject, Subtopic and Description if you want.
4. Choose the files: one PDF, or images in page order.
5. Click save and wait until the upload finishes.
6. To remove a book, use its delete button and confirm. This cannot be undone.

> 💡 Admin also sees "Admin · Reading Activity" under the shelf. Click a book there to see each reader's progress.

#### 17.7 Add questions to the Question Bank

1. Open the "Question Bank" tab and then the "✏️ Manual Add" sub-tab.
2. Fill course, subject, chapter, the question, options A and B (at least) and the correct option.
3. Click "+ Add Another Row" if you have more questions.
4. Click "✅ Save". If a question looks like one already in the bank, you are asked "Save anyway?".
5. For many questions at once, use the "📤 Bulk Paste" sub-tab.

> 💡 Write fractions as 5/4 or 2 1/3. "🔄 Clear All" empties the form.

#### 17.8 Run an entrance exam

1. Open the "Entrance Exam" tab and click "New exam".
2. Fill the exam name and exam date (required), pattern, seats and rooms, then click "Create exam".
3. Go through the tabs in order: Applications, Question Paper, Hall Tickets, Exam Day, Evaluation, Results, Admission.
4. In Question Paper click "✦ Generate paper". In Hall Tickets click "① Allot seats" then "② Issue hall tickets".
5. The Overview tab shows the next step to do.

> 💡 What you can add, edit or delete here depends on your role permissions.

**Good habits**

- Tabs keep what you typed when you switch between them, so a half-written question is not lost.
- The number on each tab is the live count of materials, aids, questions or exams.
- The "Connected to this page" cards jump to related tabs, for example from a chapter to its questions.
- On a phone, the sections are at the bottom of the screen.

**Common mistakes**

- Saving a question with no correct option marked → always choose the correct option, because the form needs it.
- Deleting a material or teaching aid by mistake → Delete cannot be undone. Check the title before you confirm.
- Looking for Create Paper or Stats as a non-Admin → these are Admin-only tabs and are hidden for others.
- Pasting a link on the same line without a title → write a title first, then the link.

**Questions people ask**

- **Why can I not download a PDF?** Only Admin can download. Other staff get "View Only" for files. Links and videos open normally.
- **Why is a tab missing?** Each tab has its own permission. Ask Admin to give you access in Permissions.
- **What is the difference between Question Bank and the Viewer?** Question Bank is where you add and edit. The Viewer is read-only and good for revision and printing.
- **Who can delete a question?** Only Admin. Any staff with access can browse, add and edit questions.

### 18. Study Lockers

_Used by: Admin, Teacher_

Each teacher gets a password-protected locker for their own study materials. From a locker you can also make practice papers as PDF or Word files.

**Before you start**

- Admin must create a locker for the teacher and give the teacher the password.
- To make a paper from the Question Bank, questions for that subject must already be in the Question Bank.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 🗃️ All Lockers | All lockers as cards. Filter by course, then click a card to unlock or open it. |
| Teacher locker tab (shows the icon and teacher name) | Appears after you unlock a locker. Shows that locker's materials, search and filters. |
| ⚙️ Admin | Admin only. Create lockers, reset passwords and delete lockers. |

**How to…**

#### 18.1 Create a locker (Admin only)

1. Open Study Lockers and click the "⚙️ Admin" tab.
2. Type the "Teacher Name".
3. Choose the "Course" and then the "Subject".
4. Type the "Locker Password". Share it with the teacher yourself.
5. Pick an icon and a locker colour.
6. Click the create button. A message says the locker was created.

> 💡 All of Teacher Name, Subject and Password are required.

#### 18.2 Unlock and open your locker

1. Open the "🗃️ All Lockers" tab.
2. Use the course buttons (All Courses, Sainik School and so on) to find your card.
3. Click your locker card.
4. Type the password in "Enter Locker Password" and click the unlock button.
5. If the password is wrong, you see "Incorrect password. Try again."

> 💡 A locker locks again by itself after 30 minutes. Click "🔒 Lock" to lock it sooner.

#### 18.3 Add materials to your locker

1. Unlock your locker.
2. Click "📋 Bulk Paste".
3. Paste your list: one item per line, with a title and a Drive or YouTube link.
4. Click "🔍 Detect Items with AI" and wait.
5. Check the list and untick anything you do not want.
6. Click "✅ Save … to Locker".

> 💡 If detection fails, a "Parse error" message shows. Check your internet and try again.

#### 18.4 Find or delete a material

1. Use "🔍 Search materials…" to search by title or chapter.
2. Use the type buttons (All, Notes PDF, Formula Sheet and so on) to filter.
3. Click "▶ Watch", "🔗 Open Link" or "📥 Download" to open a material.
4. To remove one, click "🗑 Delete" on it and confirm. This cannot be undone.

> 💡 Delete is shown only while the locker is unlocked.

#### 18.5 Make a practice paper

1. Unlock your locker and click "📄 Create Paper".
2. Type the "Paper Title" and the "Instructions".
3. Choose the Question Source: "📚 From QBank" or "✍️ Type Manually".
4. For QBank: tick the questions you want, or use "Select All". The selected count and total marks show beside it.
5. For manual: click "+ Add Question", type the question, options A to D, the correct answer and the marks.
6. Click a download button: "📄 PDF (Question Paper)", "📄 PDF (With Answers)", "📝 Word Doc" or "📝 Word (With Answers)".

> 💡 Give students the paper without answers. Keep the "With Answers" file for the teacher.

#### 18.6 Reset a password or delete a locker (Admin only)

1. Open the "⚙️ Admin" tab.
2. To reset: click "🔑 Reset PW" on the locker, type a new password and confirm.
3. To delete: click the 🗑 button and confirm. The materials inside are unlinked, not erased.

**Good habits**

- The green dot and 🔓 show which lockers are open right now.
- You can arrive here from another module with a subject already highlighted (🎯 badge on matching lockers).
- Passwords are stored in a scrambled form. Nobody can read an old password, so reset it if it is forgotten.

**Common mistakes**

- Forgetting the password → ask Admin to use "🔑 Reset PW".
- Leaving a locker open on a shared computer → click "🔒 Lock" when you finish.
- No questions appear in Create Paper → add questions for that subject in the Question Bank first.
- Deleting a locker to remove one file → delete only the file with "🗑 Delete".

**Questions people ask**

- **Who can see the ⚙️ Admin tab?** Only Admin roles. Other staff see All Lockers and any locker they unlock.
- **How long does a locker stay open?** 30 minutes. After that you must type the password again.
- **Where do the paper questions come from?** From the Question Bank for the locker's subject, or from questions you type in yourself.
- **Can I get my materials back if the locker is deleted?** The materials are unlinked, not erased, but the locker is gone. Ask Admin before deleting.

### People & Hostel

### 19. Kitchen

_Used by: Kitchen, Admin_

The Kitchen Ledger. Record each meal cooked (cost, items, how many students ate, bill photo), watch the monthly budget, and track cook attendance. Admin can lock days, set the budget and review the data.

**Before you start**

- Know the meal, the date and the total amount spent. Keep the bill photo ready if you want to attach it.
- Admin can add the common food items first under "Items", so staff can pick them from a list.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Ledger | Entries for the chosen month, grouped by day. Filter by date or meal. Shows meal totals, cost per student and missing-meal alerts. |
| Analytics | Charts: monthly spend, meal split, calendar heat map, vendor summary and most used items. Click a day on the calendar to open it in the Ledger. |

**How to…**

#### 19.1 Add a meal entry

1. Open Kitchen. Check the month in the top right (change it if needed).
2. Press "Add entry".
3. Choose the Meal: Morning Lunch, Afternoon Breakfast, Evening Breakfast or Dinner.
4. Check the Date and type the Amount (₹). Date and Amount are required.
5. Optional: Serving Time, Items / Ingredients (pick from "🍛 Manipuri Dishes" or "🧺 Item List", or type a custom item and press Enter).
6. Optional: Prepared By, Vendor / Supplier, Students Served, Meal Quality and Notes.
7. Optional: attach the bill under "📎 Receipt / Bill Photo".
8. Save the entry. "Entry saved" shows.

> 💡 Fill "Students Served" every time. It is used to work out the cost per student.

#### 19.2 Find or fix an entry

1. Stay on the "Ledger" tab.
2. Use the date box or the meal list to filter the entries.
3. Press "Edit" on the entry, change it and save.

> 💡 If a day is locked ("🔒 Locked"), its entries cannot be edited. Ask the Admin to unlock it.

#### 19.3 Check missing meals and cost per student

1. On the Ledger tab, look at the alert for missing meals. It has a button to log the meal.
2. Read the cost per student card and the meal totals below it.
3. Press "Report", "CSV" or "WhatsApp" at the top to print, download or share the month's data.

#### 19.4 Mark cook attendance (Admin)

1. Press "Cook attendance" at the top. This panel is for Admin.
2. In "📋 Mark", set each cook's status for the Morning (6:30 to 9:00 AM) and Evening (6:00 to 9:00 PM) shift. Check the in and out times.
3. Add Notes if needed and save. "Attendance saved" shows.
4. Open "📊 Monthly" to see the month's attendance.

#### 19.5 Set the monthly budget (Admin)

1. Press "Budget" at the top.
2. Type the Budget Amount (₹).
3. Save. "Budget updated" shows.
4. The budget bar then shows spent against budget for the month.

#### 19.6 Lock a finished day (Admin)

1. On the Ledger tab, find the day.
2. Press the lock button on that day and confirm.
3. The day shows 🔒 Locked and its entries cannot be edited or deleted.
4. To change something later, press unlock first.

#### 19.7 Manage items and other Admin tools

1. "Items": the kitchen item list. Add or edit items in the master list, or search the list.
2. "Monitor": the Admin Monitor panel to review kitchen entries.
3. "Cook log": Log Cook Activity with the cook name, meal, arrived and left time, then press "Save Log".

**Good habits**

- Enter the meal on the same day while you remember the details.
- Attach a photo of the bill for every purchase so the Admin can check it.
- Use the same vendor names each time so the Analytics vendor summary is correct.
- The Admin tools (Items, Monitor, Cook log, Cook attendance) appear only for Admin and Superintendent.

**Common mistakes**

- Wrong amount or date → Edit the entry (if the day is not locked).
- Trying to delete an entry → Only Admin and Superintendent can delete. Ask them.
- Forgetting the students served → The cost per student will be wrong. Edit the entry and add the number.
- Trying to edit a locked day → Ask Admin to unlock the day.

**Questions people ask**

- **Who can delete an entry or lock a day?** Only Admin (and Superintendent). Other staff see no delete or lock buttons.
- **What are the four meals?** Morning Lunch, Afternoon Breakfast, Evening Breakfast and Dinner.
- **How do I see another month?** Use the month box in the top right of the screen.

### 20. Staff

_Used by: Admin, HR_

Staff profiles, task assignment, monthly performance scores and staff location attendance. Everyone can look; only Admin and Staff Manager can add, edit or delete.

**Before you start**

- Salary is set separately after the profile is added, and it needs the Admin PIN.
- For performance scoring, attendance and tasks should already be recorded for the month.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 👥 Staff | Staff cards with search and filters. Add, edit, set salary, delete and enrol face from here. |
| 📋 Tasks | Task monitor. See all tasks, their status and who is late. Assign new tasks. |
| 📊 Scoring | Admin only. Monthly performance scoring for every staff member. |
| 🏆 Leaders | Performance leaderboard for the chosen month. |
| 📅 History | Choose one staff member to see their score history and trend. |
| 📍 Geo | Location-based attendance. Staff mark their own attendance here. Admin also sees pending face enrolments. |

**How to…**

#### 20.1 Add a new staff member

1. Open Staff. On the "👥 Staff" tab click "➕ Add Staff".
2. Fill "Full Name *" and "Designation *". These two are required.
3. Fill Phone (10 digits), Email, Joining Date and Qualification if you have them.
4. Choose Department, Role (Teaching, Non-Teaching, Admin or Teaching + Admin) and Status.
5. Click "✅ Save Staff".
6. Then set the salary: click "🔐 Salary" on the new card.

> 💡 A wrong phone or email shows a red warning under the box. Fix it and save again.

#### 20.2 Find a staff member

1. Type in "🔍 Search name, phone, role…".
2. Use the "All Status" and "All Roles" boxes to filter.
3. Use the page arrows at the bottom. Each page shows up to 25 staff.

#### 20.3 Edit a profile or delete a staff record

1. Find the staff card.
2. Click "✏️ Edit", change the details and save.
3. To delete, click "🗑 Delete" and confirm "Delete".

> 💡 Delete is permanent. If someone has left, consider changing Status to Inactive instead.

#### 20.4 Set salary (needs Admin PIN)

1. Click "🔐 Salary" on the staff card.
2. If asked, type the Admin PIN and click "🔓 Verify".
3. Fill Basic Salary, HRA, Seniority Allowance, Loyalty Bonus and Role Bonus in rupees.
4. Save. A message says "Salary saved".

> 💡 After you enter the PIN, salary stays unlocked for 15 minutes. A green "🔓 Admin session active" badge shows this.

#### 20.5 Assign a task

1. Go to the "📋 Tasks" tab and click "＋ Assign Task". You can also use the assign button on a staff card.
2. Type the "Task Title *" and the instructions.
3. Choose "Assign To *", Department, Priority (High, Medium, Low) and Due Date.
4. Click "✅ Assign Task".
5. Later, use "Start" to move a task to In Progress, and "✅" to mark it Done. "View" shows the details.

> 💡 Click a staff box in "Staff Task Overview" to see only that person's tasks.

#### 20.6 Do the monthly performance scoring (Admin only)

1. Open the "📊 Scoring" tab.
2. Choose the month and set the working "Days".
3. Click "⚡ Auto-Mark All". It fills attendance, tasks, feedback and initiative from the records.
4. Check the numbers and change any that look wrong.
5. Click "💾 Save".
6. When the month is final, click "✅ Lock" and confirm.

> 💡 The score is out of 100: attendance 30, punctuality 20, tasks 20, feedback 15, initiative 15.

#### 20.7 Mark your own attendance by location

1. Open the "📍 Geo" tab.
2. Follow the Self Attendance screen to mark attendance using your device location.

> 💡 Allow location access in the browser when it asks.

**Good habits**

- Staff who cannot edit see a "👁 View only" badge at the top.
- Levels used in scoring: Elite 90+, Outstanding 75-89, Excellent 60-74, Good 45-59, Probation below 45.
- On a staff card, "🧑‍💼 Enroll Face" starts face enrolment. It shows "Face ✓" when done.
- The Gross Salary on a card is the sum of basic, seniority, loyalty, role bonus and HRA.

**Common mistakes**

- Saving without Designation → Name and Designation are required. Fill both.
- Typing a phone number with spaces or letters → use exactly 10 digits.
- Locking scores too early → "Lock" cannot be reversed. Save and check first.
- Deleting a staff record that is only on leave or has left → set Status to Inactive instead.

**Questions people ask**

- **Why can I not see Add Staff or Edit?** Only Admin, Co-Admin and Staff Manager can change staff records. Others have view-only access.
- **Why is the Scoring tab missing?** Scoring is for Admin only.
- **The Salary button asks for a PIN. What is it?** It is the Admin PIN. Ask the Admin. Without it you cannot see or change salary.
- **What does Auto-Mark All use?** It uses location attendance records, task records and exam scores to fill the score fields.

### 21. HR

_Used by: Admin, HR_

The Staff Attendance tracker. Mark daily staff attendance, see absentees, apply for and approve leave, check location check-ins, see risk and compliance warnings, and manage teaching shifts.

**Before you start**

- Staff must already be added in the Staff module.
- Only Admin, Principal and Vice Principal can mark attendance, override check-ins, assign shifts and use Bulk Ops. Others see "View Only Mode".

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📊 Dashboard | Quick overview of staff attendance numbers. |
| 📅 Daily | Pick a date and mark each staff member Present, Absent, Late or Leave. |
| 📉 Absentees | The top 10 staff with the most absences in a chosen month. |
| 🏖️ Leaves | Leave requests with filters. Apply for leave, approve or reject. |
| 🎯 Risk | Absence risk for each staff member (High, Medium or Low) based on past records. |
| 📈 Performance | Attendance scorecards for each staff member. |
| ⚖️ Compliance | Warnings for staff with too many absences or worrying patterns, with a suggested action. |
| 🔄 Shifts | Assign teaching time slots (Morning, Slot, Evening, Self Study) to staff. |
| 📍 Geo | Location check-ins by staff for a date. Admin can override a failed check-in. |
| ⚙️ Bulk Ops | Mark all active staff at once, or import attendance from a CSV file. |

**How to…**

#### 21.1 Mark daily attendance

1. Open HR and click the "📅 Daily" tab.
2. Choose the date.
3. Find the staff member. Use the filter buttons (ALL, PRESENT, ABSENT, LEAVE) if needed.
4. Click one of "✓ Present", "✗ Absent", "⏰ Late" or "✈ Leave".
5. A message such as "Marked Present" appears. Present also records the check-in time.

> 💡 Clicking again with a different status simply changes the record for that day.

#### 21.2 Apply for leave for a staff member

1. Open the "🏖️ Leaves" tab and click "＋ Apply Leave".
2. Choose the staff member (only active staff are listed).
3. Fill the leave type, start date, end date and "Reason...".
4. Click "Submit Leave". If a field is missing you see "Fill all fields".

> 💡 The list shows each request with its days and status.

#### 21.3 Approve or reject a leave request

1. Open the "🏖️ Leaves" tab.
2. Use the filter buttons (all, submitted, hod approved, principal approved, approved, rejected).
3. On a request with status SUBMITTED, click "✓ Approve" or "✗ Reject".

> 💡 Only requests that are still SUBMITTED show the two buttons.

#### 21.4 Approve a location check-in that failed

1. Open the "📍 Geo" tab and choose the date.
2. Find the staff member whose check-in is not approved.
3. Click "Override ✓".
4. The check-in is approved and attendance is marked Present.

> 💡 Only Admin, Principal and Vice Principal see Override. Verified check-ins mark attendance automatically.

#### 21.5 Assign a teaching shift

1. Open the "🔄 Shifts" tab and choose the date.
2. Click "＋ Assign".
3. Choose Staff, Time Slot, Batch and Subject. All four are required.
4. Save. A message says "Shift assigned!".
5. To remove a shift click the 🗑 button and confirm "Delete".

#### 21.6 Mark everyone at once or import a CSV

1. Open the "⚙️ Bulk Ops" tab.
2. Choose the "Target Date".
3. Click "✓ Mark All Present" or "✗ Mark All Absent". Only active staff are marked.
4. Or choose a CSV file with two columns, staff_id and status (example: 101,Present). The first row is a heading.
5. Check the preview list and click "✓ Confirm Import".

> 💡 Bulk marking replaces any status already saved for that date.

#### 21.7 Check warnings in Compliance

1. Open the "⚖️ Compliance" tab.
2. Read each warning: more than 8 absences in this month, 3 or more absences in a row, or a Friday absence pattern.
3. Take the suggested action (for example, issue a warning letter).
4. Click "Dismiss" to hide a warning from the list.

> 💡 The "✓ Approve" button here only shows a message. It does not send a letter or change any record.

**Good habits**

- The tracker uses the last 3 months of attendance records.
- Use "📉 Absentees" before the monthly meeting to see who needs a talk.
- Check the date before you mark. The Daily tab starts on today.

**Common mistakes**

- Clicking Mark All Absent by accident → it overwrites that date for every active staff. Mark All Present again, or fix individually in Daily.
- Marking the wrong date → check the date box before clicking a status.
- CSV with names instead of ids → use the numeric staff_id in the first column.
- Expecting Dismiss to delete a warning forever → it only hides it until the page reloads.

**Questions people ask**

- **Why can I only view and not mark?** Only Admin, Principal and Vice Principal can mark attendance. You will see "View Only Mode".
- **Is this the same as the Leave module?** No. The Leaves tab here is a quick leave list. The Leave module has the full leave system.
- **What does Present from Geo mean?** The staff member checked in near the school using their phone location, or Admin used Override.

### 22. Leave

_Used by: Admin, HR, Any staff_

Staff leave requests. Admin applies for staff, approves or rejects, and sees unpaid leave deductions. Teaching and Non-Teaching staff see only their own leave records.

**Before you start**

- Staff must already be added in the Staff module.
- Only Admin (Admin, Administrator, Co-Admin or Teaching + Admin) can apply, approve, reject or delete. Other staff can only view.

**How to…**

#### 22.1 Apply leave for a staff member

1. Open Leave and click "Apply leave".
2. Choose "Select Staff *".
3. Choose "Leave Type *": Casual Leave or Sick Leave.
4. Choose "Half Day Type": Full Day, First Half (0.5 day) or Second Half (0.5 day).
5. Pick "From Date *" and "To Date *".
6. Write the "Reason *".
7. Check the balance box and the Deduction Preview.
8. Click "Submit leave request". The request is saved as Pending.

> 💡 The To Date must not be before the From Date. If the staff already has leave on those dates, a warning shows and you cannot submit.

#### 22.2 Understand the balance and unpaid leave

1. Each staff gets 12 leave days per session. The session runs from 10 January to 9 January and resets every 10 January.
2. After you choose a staff member, the form shows the total, used and remaining days.
3. If the request is more than the balance, you see "Exceeds balance - will be treated as LWP".
4. To make a leave unpaid, tick "Mark as Unpaid Leave (LWP)".
5. The Deduction Preview then shows the money that will be cut, using the daily rate.

> 💡 Only approved leave counts as used days.

#### 22.3 Approve or reject a request

1. Find the request. Use the search box or the "All Status" box (Pending, Approved, Rejected).
2. Click "✅ Approve" or "❌ Reject".
3. The status changes and the action is saved in the leave history.

> 💡 The Pending box at the top is a quick filter. Click it to see only pending requests.

#### 22.4 Approve or reject many requests at once

1. Tick the box on each request, or tick the top box to select all in the list.
2. A bar appears. Click "✅ Approve All", "❌ Reject All" or "🗑 Delete All".
3. Confirm the question that pops up.
4. Click "Clear" to unselect.

> 💡 Check the list first. Delete All cannot be undone.

#### 22.5 See details and history of one request

1. Click the 👁 button on the request.
2. A window opens with the full details and the history of actions.
3. Close it with ✖.

#### 22.6 Use the calendar view and export

1. Click "Calendar" at the top to see leave on a calendar. Click "List" to come back.
2. Admin can click "Export" to download the leave records as a CSV file.

#### 22.7 See your own leave (Teaching and Non-Teaching staff)

1. Open Leave.
2. You see only your own leave records and their status.
3. To apply for leave, ask Admin or HR.

**Good habits**

- The top cards show Pending, Approved, Rejected, and for Admin the unpaid leave deduction this month and in total.
- Search works on staff name, department, leave type and reason.
- Write a clear reason. It helps whoever approves later.

**Common mistakes**

- Submitting leave for dates that already have leave → the form blocks it. Check the existing request first.
- Choosing the wrong half-day type → a half day counts as 0.5. Choose Full Day for whole days.
- Using Delete when you meant Reject → Reject keeps the record. Delete removes it for good.
- Forgetting to tick Unpaid Leave (LWP) when the staff has no balance left → tick it so the deduction is shown.

**Questions people ask**

- **Why can I not see the Apply leave button?** Only Admin roles can apply for leave. Other staff can only view their own records.
- **How many leave days does a staff member get?** 12 days per session. The session resets every 10 January.
- **Where do students apply for leave?** Student leave and gate passes are in the Hostel module, not here.
- **Is there a separate leave list in HR?** Yes, the HR module has a quick Leaves tab with its own approval steps. The Leave module is the full record.

### 23. Hostel

_Used by: Housemaster, Warden, Admin, Kitchen_

Daily running of the boarding houses: roll call twice a day, discipline, sickbay, repairs, journal, mess duty, activities, leave, money, and reports. Housemasters must also complete six daily record checks. Missing them is recorded and Admin is told.

**Before you start**

- Houses must be created, and each boarder must be assigned to a house (Hostel → Houses). Roll call only lists students who have a house.
- Housemasters must be added under the HM section with Active status. Their name must match their login name.
- Students who are Inactive or Dropout are not in the roll call.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📊 HM Dash | Home screen of the housemaster: today's roll call, numbers and quick links. |
| ✅ Roll Call | Mark every student in each house, morning and night. Also holds the mandatory daily checks. |
| 🧳 Leave | Hostel leave requests and approvals. |
| ➕ Sickbay | Students who are sick or admitted to sickbay. |
| ⚠️ Discipline | Discipline incidents and what was done. |
| 🏛️ Houses | Create and edit houses, and assign students. Only Admin can change houses. |
| 🍽️ Kitchen | Meal records for the kitchen. |
| 🛠️ Repairs | Repair complaints for the house (plumbing, electrical and so on). |
| 🗓️ Schedule | The hostel daily schedule. Only Admin can add, edit or remove activities. |
| 🌙 Mess Duty | Mess and night duty assignments. Only Admin can assign. |
| 📋 Activities | Housemaster Daily Checklist, Duty Roster, House Students and Activity Log. |
| 📓 Journal | Daily diary entries of the housemaster. |
| 📦 Parent Items | Items parents left for hostel students. |
| 🛡️ Superintendent | Superintendent review of discipline cases. |
| 🚨 Neglect Report | Admin only. List of missed daily checks, late roll calls and rushed roll calls. |
| 📑 Roll Call Report | Report of roll calls by house and housemaster. |
| 🚨 Command Centre | Overview screen for Admin and Superintendent. |
| 🖥️ Monitor | Admin monitor of housemaster activity. |
| 💰 Contributions, 🧾 Expenses, 📊 Money Dashboard | House money: contributions from students, expenses, and the totals. |
| 📄 A4 Stock, 📚 Study Material | A4 paper stock and study material given to students. |
| 🧑‍🏫 HM, 💬 Doubt, 📚 Classes | Housemaster list, doubt sessions and class timetable. |
| 🚌 Day Scholar, 🔄 Transfer | Day scholar records and student house transfer. |

**How to…**

#### 23.1 Do the roll call (every morning and every night)

1. Open "✅ Roll Call" (or press the gold "✅ Roll Call" button at the top).
2. Choose the date and the session: Morning or Night.
3. Find your house card. It shows how many students are marked.
4. Press "⚡ Quick Roll Call". For each student choose one: Present, Absent, Late, On Leave or Sick.
5. Keep going until every student is marked (100 percent).
6. When the house reaches 100 percent, a House Report opens with absent, late, on leave and sickbay students. You can press "🖨️ Print Report".

> 💡 Deadlines: Morning roll call by 7:00 AM. Night roll call by 8:00 PM. You get 15 minutes extra.

#### 23.2 Understand the roll call rules

1. Late rule: if the LAST student is marked more than 15 minutes after the deadline, the roll call is recorded as late. A penalty or fine applies, and Admin is notified.
2. Blocked rule: if yesterday's morning AND night roll call were not both 100 percent, today's roll call is blocked ("🚫 Roll call is blocked").
3. To unblock, press "📋 Complete Missed Roll Call" and finish yesterday's sessions.
4. Only Admin sees "🔓 Override & Allow Roll Call (Admin)".
5. Rushed rule: marking students in less than 2 seconds each (for 3 or more students) is flagged to Admin. Marking 3 or more students Present at once with a bulk button is also flagged.
6. Pending leave requests of your students must be reviewed on the roll call finish screen.

> 💡 Check each bed. Do not tap through.

#### 23.3 Complete the six mandatory checks

1. After roll call, the finish screen runs the "Six-Tab Compliance" check for your house.
2. It looks for at least one record in each of: ⚠️ Discipline, 🏥 Sickbay, 🔧 Repairs, 📝 Journal, 🍽️ Mess Duty, 📌 Activities, made in the time window.
3. Window for the roll call check: Morning roll call = 12:00 AM to 12:00 noon. Night roll call = 12:00 noon to midnight.
4. For every missing one you see a red "STRICT WARNING — Mandatory Checks Skipped". It is recorded and sent to Admin.
5. Press "Log an entry →" to go to that tab and add a record. The Add form opens for you.
6. If nothing happened that day, press "✅ Nothing to report".
7. You can only skip a check by writing a real reason. A short reason such as "ok" or "na" is not accepted.

> 💡 Skipping with a reason or "Nothing to report" does not erase the gap. Admin still sees it in the Neglect Report.

#### 23.4 Do the 3 daily compliance slots

1. On the Roll Call tab, open "📋 Mandatory 3x-Daily Compliance".
2. There are three slots: 🌅 Morning (12 AM to 8 AM), ☀️ Afternoon (8 AM to 4 PM) and 🌙 Night (4 PM to midnight).
3. A slot is locked until the matching roll call is 100 percent. Morning and Afternoon need the Morning roll call. Night needs the Night roll call.
4. When it unlocks, the same six checks are run. Use "✓ Complete" to add a record or "⏭ Skip" with a proper reason.
5. If gaps are found, a message is prepared for the compliance WhatsApp group and the mandatory number. Copy and send it.

#### 23.5 Record a sickbay case or a discipline incident

1. Open "➕ Sickbay" or "⚠️ Discipline" and press "➕ Add Record".
2. Search and select the student. Name, GCC No. and class are filled in.
3. Sickbay: write the Complaint (required). You can add Treatment Given, Referred To, Admitted Date and Attended By.
4. Discipline: write the Incident Description (required) and Action Taken, Reported By and Status (Open, In Progress, Resolved, Closed).
5. Press save. The student's housemaster is notified. For discipline, all Superintendents are also notified.
6. Later, when a sick student recovers, use the discharge button. It sets Discharged and today's date.

> 💡 Only Admin can delete sickbay or discipline records.

#### 23.6 Raise a repair, write a journal entry, or assign mess duty

1. Repairs: open "🛠️ Repairs" and press "➕ Raise Complaint". Fill Category, House, Location/Block (required), Description (required) and Priority. Only Admin can fill "Assigned To" and delete.
2. Repair status goes Raised, Assigned, In Progress, Resolved, Closed. Only Admin can press "Assign".
3. Journal: open "📓 Journal" and press "📝 New Entry". Fill Date, Title, Content (all required), Category and House.
4. Mess Duty: Admin presses "➕ Assign Duty", picks Date, Shift (Breakfast, Lunch, Tea, Dinner, Full Day) and up to three staff with roles.

> 💡 Only Admin can delete journal entries and mess duty records.

#### 23.7 Log housemaster activities

1. Open "📋 Activities". It has four views: ✅ Daily Checklist, 📋 Duty Roster, 🏠 House Students and 📋 Activity Log.
2. In the Daily Checklist choose the housemaster and tick each duty done. The checklist resets every midnight.
3. Submit the day report. It is saved as an activity named "Daily Task Summary Report".
4. In the Activity Log you can log a single activity. A housemaster can edit only their own logs. Only Admin can delete activity logs or change the duty roster.

**Good habits**

- The ☰ "All sections" menu (top right) lists every Hostel section in groups. Type in the box to find one. On a phone use the bottom bar: Home, Roll Call, Leave, Sickbay, More.
- A housemaster sees their own house. Admin sees all houses.
- A housemaster who fills the six tabs after roll call each day will never appear in the Neglect Report.
- Admin can open "🚨 Neglect Report" to filter by house and housemaster and to download the list.
- Admin only: assign students to houses in "🏛️ Houses", or from the roll call screen for unassigned students.

**Common mistakes**

- Marking the whole house Present in one tap → mark each student. Bulk Present is flagged to Admin as unchecked.
- Finishing roll call late (after 7:15 AM or 8:15 PM) → mark on time. A late roll call costs a penalty.
- Forgetting yesterday's night roll call → today is blocked. Press "📋 Complete Missed Roll Call".
- Ignoring the red warning on the finish screen → add the record or give a real reason. It is already logged.
- Pressing "✅ Nothing to report" every day for the same tab → if this happens in most of the last sessions, Admin is alerted.
- Student missing from the roll call → the student has no house, or is Inactive/Dropout. Ask Admin to check.

**Questions people ask**

- **What happens if I miss the deadline?** The roll call is flagged Late when the last student is marked after the deadline plus 15 minutes. It is added to the Neglect Report, Admin gets a message, and a penalty or fine applies.
- **Who can delete records?** Only Admin can delete discipline, sickbay, repair, journal, mess duty, activity and day scholar records.
- **Where do I see my own compliance?** On the Roll Call finish screen under Six-Tab Compliance. Admin sees all houses in the Neglect Report.
- **How do I approve a leave request?** On the roll call finish screen, or in the Leave tab. The housemaster approves first. Some requests then need the Superintendent.

### 24. Awards

_Used by: Admin, Teacher, Housemaster_

Monthly awards for staff and houses. Every day a supervisor ticks yes or no for each nominee. At month end the winner is worked out from those ticks.

**Before you start**

- Housemasters must be entered as Active in the Housemasters list. They become the House Master and Doubt Session nominees.
- Staff must be Active with role "Teaching" or "Non-Teaching" in the staff list. They become the Faculty and Non-Teaching nominees.
- Houses must exist, because they become the Best House nominees.

**Screens in this module**

| Screen | What it is for |
|---|---|
| ✅ Today's ticks | Daily checklist, one award category at a time. |
| 📋 Master table | The same daily checklist for all five categories in one long page. |
| 🏆 Leaderboard | Monthly ranking, publishing the winner, certificate and downloads. |
| ⚙ Settings | Attendance gate, Best House mark scale and leave records for nominees. |

**How to…**

#### 24.1 Tick the daily checklist

1. Open "✅ Today's ticks". Choose a category button: House Master, Doubt Session Staff, Non-Teaching Staff, Faculty or House.
2. The date box "Editing:" shows today. Each nominee who is not yet saved shows a form.
3. Mark Present or Absent for the nominee. This is compulsory, except for House Master where the roll call tick is used as attendance.
4. Tick every point you saw that day. Leave a point unticked if it was not done.
5. Press "Save". The nominee then folds into a short row with a green ✓.
6. The text "x of y done" at the top shows how many are left.

> 💡 Do this every day. The ranking is the share of recorded days with a tick.

#### 24.2 Fill a normal day quickly

1. On the daily checklist, press "Mark all N remaining as normal day".
2. Confirm the message. Everyone not yet saved is saved as Present with every point ticked yes (and full marks for Best House).
3. Press "Edit" on any nominee who had a problem, change the ticks and press "Save".

> 💡 Only use this if you really observed a normal day. Do the exceptions first, then use this for the rest.

#### 24.3 Enter the Best House mark

1. Choose the "House" category button.
2. For each house, type the day's inspection mark in "Mark (out of N)". It is compulsory.
3. Mark Present or Absent, tick the checklist points, and press "Save".

#### 24.4 Fix a past day

1. Change the date in the "Editing:" box to the earlier day. A red "Editing a past day" label appears.
2. Correct the ticks and press "Save" for each nominee.
3. Press "Back to today" when you are done.

> 💡 You cannot choose a future date.

#### 24.5 Record leave for a nominee

1. Open "⚙ Settings" and go to "Leave management".
2. Choose the category, then the Nominee.
3. Set Start and End dates and an optional Reason, then press "Add leave".
4. On those dates the nominee shows "ON LEAVE" in the daily list and is not asked for ticks. If all recorded days are covered by leave, the leaderboard shows "On leave" instead of a low-attendance warning.
5. To undo, press "Remove" next to the leave record and confirm.

#### 24.6 See the ranking and publish a winner

1. Open "🏆 Leaderboard" and choose the category and the month.
2. Read the ranking. Each line shows score, days recorded, attendance percent, streak and change from last month.
3. The first eligible nominee is marked "LEADING". The text "Publishes ..." shows the planned publish date (the 10th, or the 11th if the 10th is a Sunday).
4. Press "Confirm & publish winner" to confirm the winner.
5. After publishing, press "Download certificate" for the certificate.
6. Use "⬇ Excel (CSV)" or "⬇ PDF" to download the ranking list.

> 💡 The red box "not ticked today" lists nominees you forgot to tick today.

#### 24.7 Change the attendance gate or mark scale

1. Open "⚙ Settings" → "Scoring thresholds".
2. Change "Attendance gate (%)" (0 to 100) or "Best House mark scale (out of)" (more than 0).
3. Press "Save settings".

> 💡 New values are used the next time a screen loads.

**Good habits**

- Default rules: attendance gate is 90 percent. Best House mark scale is out of 6. Settings can change both.
- A nominee below the attendance gate is not ranked, even with perfect ticks.
- Score for a nominee = average of the percent of days each point was ticked yes. For Best House, the checklist score and the mark percent are averaged.
- A person who is a House Master is judged only in the House Master and Doubt Session categories, not in Faculty or Non-Teaching.

**Common mistakes**

- Saving without Present/Absent → the form says "Attendance is compulsory". Mark one first.
- Saving Best House without a mark → enter the day's mark first.
- House Master: "Timely roll call completed today" and "House routine tasks completed today" are marked Mandatory → give an answer for both before saving. The roll call tick is also used as attendance.
- Forgetting to tick for some days → days with no record do not count at all, so the score may not show the whole month.
- Using "Mark all as normal day" before checking the exceptions → it does not change people already saved, but it will mark everyone else as perfect.

**Questions people ask**

- **Why is a nominee not ranked?** The reason is shown next to the name: "No attendance recorded this month", "Below N% attendance gate" or "On leave".
- **Can I publish a winner again?** After publishing, the page shows the winner with a certificate button instead. Only press "Confirm & publish winner" when the ranking is final.
- **Where do the Co-housemasters get set?** The Settings page says this is done directly in the database (award_house_co_masters table). It does not change individual scores.

### 25. Face Attendance

_Used by: Any staff, Admin, Accountant_

Staff attendance with face check and phone location, plus the pay side: time card, advances, late fines and monthly Payroll. Every staff member uses it to check in. Admin uses it to approve faces and run payroll.

**Before you start**

- Your account must be linked to a staff profile, or you see "Your account isn't linked to a staff profile".
- Your face must be enrolled and approved by Admin before you can check in.
- For payroll, an active salary deduction rule must exist, and each staff member needs a basic salary set in the Staff module.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Home (staff) / 📊 Dashboard (Admin) | Starting screen with Punch In, Punch Out and Time card shortcuts. Admin starts on the Dashboard. |
| ✅ Take attendance | Check in and check out with face and location. |
| 📅 Attendance | Your own attendance history. Admin sees the roster of all staff. |
| 🕐 Time card | Check-in and check-out times for the month. |
| 💵 Advances | Salary advances and how they are repaid. |
| ⏰ Late fines | Late and absent fines worked out from attendance. |
| 💰 Payroll | Monthly pay estimate. Admin can adjust, approve, mark paid and print payslips. |
| 🛠️ Correct attendance | Ask for a correction when you forgot to check in. Admin approves. |
| 📊 Reports | Attendance reports. Needs the View Attendance Reports permission. |
| 📣 Broadcast messages | Messages sent to staff. |
| 🔔 Notifications | Your attendance notifications. |
| Admin-only screens | Staff coverage, Live geo monitor, Geo fraud alerts, Shift configuration, Campus zones, Geo attendance report, Approvals, Enrollment report, Cash book, Role Permissions, Attendance Helpers, Control Center. |
| ⚙️ Settings | Settings for this module. |

**How to…**

#### 25.1 Enrol your face (first time)

1. Open Face Attendance and choose "Take attendance" from the ☰ menu.
2. If your face is not enrolled, you see "Face not enrolled yet". Click "Enroll my face".
3. Allow the camera and look at the camera.
4. Capture, then click save. Use "Retake" if the photo is poor.
5. You see "Face captured - pending admin approval". Wait for Admin to approve.

> 💡 Check-in only works after approval. Admin can also enrol your face for you from the Staff module.

#### 25.2 Check in for your shift

1. Open "Take attendance" from the ☰ menu (or Punch In on Home).
2. Allow location access when the browser asks.
3. Wait for the location to show you are on campus.
4. Find your shift and click "✅ Check In".
5. Do the face check when asked.

> 💡 If you are outside the campus the button shows "Check In (Off Campus)", and after the shift start time it shows "Check In (Late)". The system still records it, and it can be flagged for Admin.

#### 25.3 Check out

1. Open "Take attendance" again at the end of your shift.
2. Click Punch Out / check out for your shift.
3. Do the face check if asked.

> 💡 On Home, Punch In is active only if you have not checked in today and Punch Out only while a check-in is open.

#### 25.4 Ask for an attendance correction

1. Open "Correct attendance" from the ☰ menu.
2. Stay on "My requests". Pick the Date.
3. In "Mark as", choose Present or Half Day.
4. Write the Reason. It is required, or you see "Enter a reason for this correction".
5. Submit. The message says "Request submitted for approval".

> 💡 Admin sees these under "Pending queue" and can approve or reject. Approval updates your attendance.

#### 25.5 Approve faces and corrections (Admin)

1. For faces: open "Approvals" from the ☰ menu. The red number shows how many are waiting.
2. Check each photo, then approve or reject. You can also approve or reject many at once.
3. For corrections: open "Correct attendance", then "Pending queue", and click Approve or Reject.
4. To see who is enrolled, open "Enrollment report".

#### 25.6 Run monthly payroll (Admin)

1. Open "Payroll" and choose the month.
2. Check the yellow line with the rates per late, absent, early-out and half day. If it says no active rule, ask for the deduction rule to be set first.
3. Open a staff card to see gross, deductions and net pay. Red flags warn about missing basic salary or no attendance.
4. To change a figure, adjust the row (amount and reason; overtime, arrears, reimbursement, other deduction, ESI and TDS are available), then Save.
5. Click "↥ Submit for approval". Then click "✓ Approve" or "✕ Reject".
6. Choose the payment mode (Cash, Bank Transfer, UPI or Cheque) and click "✓ Mark Paid".
7. Use "📄 Payslip" to see or print a slip, and "🖨️ Print all payslips" for everyone.

> 💡 Mark Paid is allowed only after Approve. It locks the row. "↺ Undo payment" unlocks it again.

#### 25.7 Issue a salary advance (Admin)

1. Open "Advances" or click "+ Issue advance" in Payroll.
2. Choose the Staff member and type the Amount (₹).
3. Choose the Issued month, give a reason, and set "Repay over (months)".
4. Save. A message says "Advance issued".

> 💡 The advance is taken out of pay in the following months through Payroll.

**Good habits**

- Staff see only their own Payroll, Time card and Advances. Admin sees everyone and can use the staff filter.
- Admin can give single permissions (View Payroll, View Late Fines, View Cash Book, View Reports, Approve Corrections, Manage Deduction Rules, Manage Advances) to a staff member in "Role Permissions".
- "Attendance Helpers" lets Admin name a helper who can take attendance for a colleague without a phone. That colleague's face is still checked.
- Use "⬇ Export CSV" in Payroll to save the month as a file.

**Common mistakes**

- Trying to check in before the face is approved → wait for Admin approval, or ask Admin.
- Checking in with location switched off → turn on location and allow it in the browser.
- Running payroll without a deduction rule → late and absent deductions become 0. Set the rule first.
- Marking Paid too early → it needs Approve first and then locks the row. Use Undo payment only if you really must.
- Forgetting to check out → send a correction request with a clear reason.

**Questions people ask**

- **Why is my Check In button not working?** Your face must be approved, location must be allowed, and you must have a shift assigned. If it says "No shifts assigned. Contact admin.", ask Admin.
- **Can I see my own salary?** You can see your own Payroll estimate and payslip. You cannot see other staff unless Admin gave you the View Payroll permission.
- **Is this the same as the Geo tab in Staff or HR?** It uses the same location attendance. This module adds face check, time card, fines and payroll.
- **Who deactivates staff here?** Admin can deactivate staff from "Staff coverage". Records are kept, and they can be reactivated.

### Operations

### 26. Reception

_Used by: Reception, Admin_

The front office desk. Look up students, sign visitors in and out, record admission enquiries and complaints, handle student leave applications and gate passes, and log items parents leave for students.

**Before you start**

- Students must already be admitted in the Students module. Student search only finds active students.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Student 360° | Search any student by name, GCC No, Admission No or Batch and see their details, hostel, gate passes and parent items. |
| Monitors | Live board (refreshes every 60 seconds) with sub-tabs Gate Passes, Hostel Leave, Staff Leave and Visitors Inside. |
| Visitor Book | Record visitors, print visitor badges, track follow-ups. |
| Enquiry | Admission enquiries with source and follow-up dates. |
| Complaint | Parent complaints with assignment, status and an update timeline. |
| Leave Application | Student leave requests. Print, then approve or reject. Approval makes a gate pass. |
| Gate Pass | Issue passes, mark exit and return, catch late returns. |
| Parent Items | Parcels and items left by parents, as a list or house by house. |

**How to…**

#### 26.1 Sign in a visitor

1. Open "Visitor Book" (or press "Sign in visitor" at the top).
2. Optional: search the student being visited and select them.
3. Type the Visitor Name (required) and Phone. If this phone number visited before, the name, purpose, meeting and ID are filled for you and "Repeat visitor detected" appears.
4. Choose Purpose, Visit Category, Meeting With, In Time and ID Proof.
5. If a follow-up is needed, set "Follow-up Required" to Yes and pick the Follow-up Date.
6. Press "Save Visitor".
7. Use the 🖨️ button on the row to print a visitor badge.

> 💡 A visitor with no Out Time shows "Still Inside" in red. The Monitors → "Visitors Inside" list shows who is inside now.

#### 26.2 Record an admission enquiry

1. Open "Enquiry".
2. Fill Parent Name, Phone, Class Interest, Source, Status (New, Follow Up, Converted, Closed), Enquiry Date and Follow Up Date.
3. Press "Save Enquiry".
4. If the phone number already has an enquiry, you are asked to confirm before adding another.
5. Use the green "💬 WA" button on a row to message the parent on WhatsApp.

> 💡 Enquiries whose follow-up date is today show in red with ⚠ and in the "Follow-ups due" count at the top.

#### 26.3 Take a student leave application

1. Open "Leave Application".
2. Search and select the student. This is required.
3. Choose Reason, Date of leave and Date of return.
4. Fill the responsible person: Name, Relation with Student, Contact No. and Address. All are required.
5. Press "Submit Leave Application". It is saved as Pending.
6. In the list, press "🖨️ Print" and get it signed.
7. After printing, press "✓ Approve" or "✕ Reject". If you reject, you must type a reason in the box that opens (you can leave it empty and press OK).
8. Approving creates a gate pass automatically with status Issued. If the student already has an active gate pass, it stops with a warning.

> 💡 Approve and Reject stay greyed out until the application has been printed.

#### 26.4 Issue a gate pass directly (Admin / Superintendent only)

1. Open "Gate Pass". Only Admin, Administrator or Superintendent see the form. Other users see "Direct gate pass issuing is restricted".
2. Search and select the student.
3. Choose Reason, Exit Date, Exit Time, Expected Return Time and Return Date (for multi-day leave).
4. Fill Responsible Person / Contact, Approved By and Parent Informed.
5. If Parent Informed is "No", you must confirm before it is issued.
6. Press "Issue Gate Pass".

> 💡 Everyone else should use Leave Application instead.

#### 26.5 Mark a student out and back in

1. In "Gate Pass" (or Monitors → Gate Passes), find the pass.
2. When the student leaves the gate, press "→ Out". Only Admin or Superintendent can do this.
3. When the student comes back, press "↩ In" (or "↩ Returned" in Monitors). Anyone at the desk can do this.
4. If the student is late, a box asks for the reason. A reason is required. The pass is then marked "⚠ Late".

> 💡 Late means after the Return Date, or after the Expected Return Time on the exit date.

#### 26.6 Log and track a parent complaint

1. Open "Complaint". Fill Parent Name, Category and Subject. These three are required.
2. Optional: Phone, link to student, Priority (Low, Normal, High, Urgent), Description, Assign To and Assigned Role.
3. Press "Log Complaint". It starts as Open.
4. Later, press "View →" on the complaint.
5. Type a note under "Add update" and/or choose a new status (Open, In Progress, Resolved, Closed, Reopened), then press "Add update".

> 💡 Every update is kept in the timeline with the time and your name.

#### 26.7 Record an item brought by a parent

1. Open "Parent Items".
2. Search and select the student, and type the Parent Name.
3. Pick the items in "Select Items". You can choose from the list or add a custom item. At least one item is required.
4. Fill Quantity, Received Date and Received By, then press "Record Item".
5. When the student gets the item, press "✓" (Deliver) on the row. Use "↩" (Return) if the item is given back. Press 🖨️ to print the item slip.
6. Switch to "🏠 By House" to see items grouped by house.

#### 26.8 Remove a record

1. Use the delete button on the row.
2. Confirm "Archive this record?". The record is hidden, not erased.
3. For a leave application, you must print it first.

> 💡 On Gate Pass, only Admin or Superintendent see the delete button.

**Good habits**

- The coloured boxes at the top (Visitors today, Students out, Follow-ups due, Leave requests, Parcels pending, Open complaints) are buttons. Click one to jump to that tab.
- "Daily summary" at the top prints the day summary.
- The 📥 Excel button on each list downloads what you see. The search box filters it first.
- A gate pass cannot be moved backward. Allowed steps are Issued → Exited → Returned.
- Monitors marks a gate pass red if the student has been outside for more than 8 hours.

**Common mistakes**

- Trying to approve a leave application without printing it → press Print first.
- Issuing a second gate pass for a student who is still out → return the first pass before issuing a new one.
- Forgetting to press "↩ In" when a student returns → the student stays in the "outside" list and the alert count.
- Typing a visitor and never setting Out Time → the visitor shows "Still Inside".

**Questions people ask**

- **Why can I not see the Issue Gate Pass form?** Only Admin or Superintendent can issue a gate pass directly. Use Leave Application and get it approved.
- **Where is hostel leave and staff leave?** In Monitors, under the "🏠 Hostel Leave" and "👩‍🏫 Staff Leave" sub-tabs.
- **Can I edit a record after saving?** Not from the list. You can change status buttons (for example Returned or Delivered), add complaint updates, or archive the record and enter it again.

### 27. Notice

_Used by: Admin, Reception, Any staff_

Write and manage circulars and announcements. A notice can be kept internal for staff, or shown on the public website.

**How to…**

#### 27.1 Add a new notice

1. Click the "➕ Add Notice" button at the top right.
2. Optional: pick a ready-made text from the "— Use template —" list (Exam Schedule, Holiday Notice, Fee Reminder, Event Announcement, Urgent Circular, Admission Open, Result Announced). It fills the title, text, category, audience and priority for you.
3. Fill the Title and the Description. Both are required.
4. Choose the Category (General, Exam, Holiday, Fee, Event, Academic) and the Audience (All, Students, Parents, Staff, Teachers, Class Specific).
5. If the audience is a single class, type it in "Class Target", for example "Class 10 A".
6. Set the Publish Date, and an Expiry Date if the notice should stop after a day.
7. Choose Priority (Normal, Important, Urgent) and Status (Published, Draft, Expired).
8. Press "Save Notice".

> 💡 Use Status "Draft" while you are still writing. Change it to Published when it is ready.

#### 27.2 Show a notice on the public website

1. In the form, tick "🌐 Show on public website (landing page)". The text below it tells you who can see the notice.
2. Or, on an existing notice, click the 🌐 button. Click it again to remove the notice from the website.
3. The green bar at the top shows how many notices are visible on guidancekhangabok.in right now.

> 💡 Only put public information here, such as admissions and results. Never put private fee or student details in a public notice.

#### 27.3 Edit, pin or publish a notice

1. Find the notice in the list. Use the search box or the filters (Audience, Status, Category, Priority, Visibility, sort order).
2. Click "✏️ Edit" to change it, then press "Update".
3. Click 📌 to pin the notice. Pinned notices always stay at the top.
4. In the table view (☰), click ⏸ to change a Published notice to Draft, or ▶ to publish a Draft.
5. Click "👁 View" (or the notice title) to open the full notice and its attachment.

#### 27.4 Copy an old notice

1. In the card view (⊞), click the ⧉ button on the notice.
2. A new notice called "Copy of ..." is made as a Draft, with today as the publish date. It is not pinned and not public.
3. Click "✏️ Edit" on the copy, change the text and set it to Published.

#### 27.5 Delete a notice

1. Click the 🗑 button on the notice.
2. Confirm the message "Delete this notice?".

> 💡 Deleting cannot be undone. If you only want to hide it, set it to Draft instead.

**Good habits**

- Notices with an Expiry Date earlier than today are changed to "Expired" automatically when the page opens.
- An amber bar warns you when notices will expire within 3 days.
- Urgent notices have a red edge and Important notices an orange edge on the card.
- Switch between cards (⊞) and table (☰) with the two buttons next to the search box.
- To attach a file, paste its web link in "Attachment URL". The module does not upload files.

**Common mistakes**

- Saving a notice as Draft and expecting it to be live → set Status to Published.
- Ticking the public option for an internal notice → untick it, or click 🌐 to remove it from the website.
- Using "Class Specific" audience but leaving "Class Target" empty → type the class in Class Target.
- Deleting a notice that is only out of date → leave it. It becomes Expired by itself.

**Questions people ask**

- **Who sees a notice that is not public?** Only logged-in staff. The notice shows "No — internal only" in the preview.
- **Why did my notice change to Expired?** Its Expiry Date has passed. Edit it, set a new Expiry Date and set Status to Published.
- **Does this send an SMS or WhatsApp message?** No. Notice only publishes the circular. To send messages, use the Connect module.

### 28. Social

_Used by: Admin, Reception_

Plan social media posts and ad campaigns, and follow up on admission enquiries (leads) that come from Facebook, Instagram, WhatsApp, walk-ins and other sources.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Daily | Your daily work screen: follow-ups that are due, posts for today, a score summary and alerts. |
| Campaigns | List of ad or promotion campaigns with platform, budget and status. |
| Leads | Everyone who has shown interest in admission, with phone, source, follow-up date and status. |
| Posts | The plan of social media posts, with date, platform, type and status. |

**How to…**

#### 28.1 Do your daily follow-up calls

1. Open the "🌅 Daily" tab. A red number on the tab shows how many follow-ups are overdue or due today.
2. Stay on "📞 Follow-ups". Work through "Overdue" first, then "Due today", then "Upcoming".
3. Tap the 📞 button to call the parent, or the 💬 button to open WhatsApp.
4. At the bottom, in "⚡ Quick note on lead", choose the lead, choose the new status, type what was said and press "Log note".

> 💡 The note is added to the lead with the date and time, and the status is changed at the same time.

#### 28.2 Log a walk-in visitor

1. In Daily → Follow-ups, press "👤 Log a walk-in".
2. Fill Student Name (required), Phone, Class interest, and Source.
3. Press "⚡ Save walk-in".
4. The lead is saved with status New, and the follow-up date is set to today.

#### 28.3 Add a lead manually

1. Open the "Leads" tab and press "+ Add".
2. Fill Student Name (required), Parent Name, Phone, Class Interest, Source and Follow Up Date.
3. Choose the Status: New, Contacted, Follow Up, Converted or Closed.
4. Press "Save Lead".

> 💡 Set a Follow Up Date. Leads with no date never show up in the Daily follow-up list.

#### 28.4 Add a campaign

1. Open the "Campaigns" tab and press "+ Add".
2. Fill Campaign Name (required), Platform, Budget, Start Date and End Date.
3. Choose the Status: Active, Paused or Completed.
4. Press "Save Campaign".
5. An Active campaign that ends within 3 days is shown as a warning on the Daily tab.

#### 28.5 Plan a post and mark it as posted

1. Open the "Posts" tab and press "+ Add".
2. Fill Title (required), Platform, Content Type (Admission, Result, Event, Topper, Announcement) and Post Date.
3. Choose the Status: Planned, Posted or Cancelled, then press "Save Post".
4. On the day, open Daily → "📢 Posts". Press the circle ○ next to the post once it is published. It turns into a tick ✓. Press again to undo.

#### 28.6 Delete a record

1. Open Campaigns, Leads or Posts.
2. Press "Delete" (or ✕ on a phone) on the row.
3. Confirm the "Delete?" message.

> 💡 Deleting cannot be undone. For a lead you no longer need, set the status to Closed with a note instead.

**Good habits**

- Use the search box in each tab to find a name, phone number or platform.
- The "📊 Score" tab shows how many leads are in each status. The "🔔 Alerts" tab lists everything that needs action today.
- Leads that are Converted or Closed are not shown in follow-ups.

**Common mistakes**

- Leaving the Follow Up Date empty → add a date so the lead appears in Daily.
- Changing a lead status but forgetting the note → use "Log note" so the history is saved.
- Marking a post as Posted before it is really published → press the ✓ again to put it back to Planned.

**Questions people ask**

- **Can I edit a lead after saving it?** Not in the Leads list. Use "Log note" in the Daily tab to add a note and change the status. To correct other details, delete the lead and add it again.
- **Does Social post to Facebook or Instagram for me?** No. It is only a planner and tracker. You post on the platform yourself.
- **What do the red and yellow follow-up labels mean?** Red "Overdue" means the follow-up date has passed. Yellow "Due today" means it is today.

### 29. Connect

_Used by: Admin, Any staff_

The communication hub. Admin writes broadcast messages to parents, students and staff, keeps message templates, and tracks replies, grievances and consent slips.

**Screens in this module**

| Screen | What it is for |
|---|---|
| ✏️ Compose | Write and send a message or an emergency alert. Admin only. |
| 📡 Broadcasts | History of all messages sent or scheduled. |
| 📨 Inbox | Replies received. A number shows unread replies. |
| 🗂️ Grievances | Complaints raised as tickets. A number shows open ones. |
| ✅ Consent | Consent slips (for example for a trip) with the count of each answer. |
| 📅 Calendar | Month view of broadcasts by date. |
| 📊 Analytics | Counts of messages by channel for the last 7, 30 or 90 days. |
| 📝 Templates | Saved message texts that can be reused. |
| ⚙️ Settings | Do Not Disturb time and the daily quota. Admin only, and not shown to other staff. |

**How to…**

#### 29.1 Send a message (Admin only)

1. Open "✏️ Compose".
2. Optional: type a Title. Choose the Audience (All, Parents, Students, Teachers, Staff, Fee Defaulters, Absent Today, Hostel Students).
3. Choose the Channel (SMS, Email, WhatsApp, Portal), Priority (Urgent, Important, General) and Language (English, Hindi, Meitei).
4. Type the Message. For SMS, a counter shows the characters and how many SMS it will use (160 characters per SMS).
5. To send later, pick a "Schedule Date (optional)". The button then reads "🗓️ Schedule".
6. Press "📤 Send Now" (or "🗓️ Schedule"), check the details in the box, then press "📤 Confirm Send".

> 💡 You can tap a saved template at the bottom of the page. It fills the message and the channel for you.

#### 29.2 Send an emergency alert (Admin only)

1. In Compose, read the red "🚨 Emergency Alert" box. It sends to ALL, through ALL channels.
2. Type the message.
3. Press "🚨 Send Emergency". Priority is set to Urgent and Audience to All.
4. Check the box and press "🚨 Confirm Emergency".

> 💡 Use this only for real emergencies, such as an accident or sudden closure.

#### 29.3 Check what was sent

1. Open "📡 Broadcasts".
2. Use the filters All, Sent, Scheduled, Urgent, Important.
3. Click a row to read the full message.
4. Admin can delete a row with "Delete" (or ✕) and confirm "Delete?".

#### 29.4 Handle a grievance

1. Open "🗂️ Grievances". The "Open" filter is shown first.
2. Read the ticket and who sent it.
3. Admin: type an "Admin note…" and press "In Progress" while you work on it.
4. When finished, press "✓ Resolve". The note is shown on the ticket.

#### 29.5 Read replies in the Inbox

1. Open "📨 Inbox" and press "Unread" to see only new replies.
2. Press "Mark Read" on a reply when you have read it.

#### 29.6 Create a consent slip (Admin only)

1. Open "✅ Consent".
2. In "➕ Create Consent Slip", fill the Title (required) and Description.
3. Edit "Options (comma-separated)" if needed. The default is Yes,No,Maybe.
4. Pick a Deadline and press "✅ Create".

#### 29.7 Save a message template (Admin only)

1. Open "📝 Templates".
2. In "➕ New Template", fill Name, Category, Channel, Language and Template Text.
3. Press "💾 Save". Admin can remove a template with ✕.

**Good habits**

- Staff who are not Admin can read Broadcasts, Inbox, Grievances, Consent, Calendar, Analytics and Templates, but cannot send or change anything.
- The top of the page shows "Quota left", unread replies and open grievances. Click the last two to jump to that tab.
- If you press Send for the same audience, channel and start of message twice, you get a "Duplicate detected" warning. Press "Send Anyway" only if you really mean it.

**Common mistakes**

- Sending a message before checking the Audience → read the confirm box carefully before pressing Confirm.
- Using Emergency for a normal notice → use the normal Send for non-urgent messages.
- Expecting Settings to be saved for later → see the question below.

**Questions people ask**

- **Why can I not see the Compose form?** Only Admin can send messages. Other staff see "Access Restricted".
- **Is there a message limit?** Yes. The screen shows "Quota" and each send uses one from it. When it is 0, you see "Daily quota exhausted."
- **Do the Do Not Disturb and quota settings stay saved?** The Save Settings button only shows a "Saved!" message on the screen. We could not confirm in the code that these values are stored, so do not rely on them.

### 30. Website Manager

_Used by: Admin, Reception_

Control what the public GNSI website shows (guidancekhangabok.in). Add notices, events, toppers, photos, videos, news, FAQs and more. It also shows enquiries that visitors send from the website. Changes show live on the website.

**Before you start**

- You need permission to open "Website Manager". Ask the Admin if you cannot see it.
- Photos are uploaded with the "Upload Photo" button inside each form. For some sections the page shows a "Copy SQL" button for a one-time database set-up. Ask the Admin or the IT person to run it if a section does not work.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 📬 Enquiries | Enquiries and grievances sent from the website. Search, reply, mark replied and export. |
| 📣 Notices | Public notices on the website, and the "Latest" scrolling strip. |
| 📅 Events | Dated events shown on the homepage. |
| 🏆 Ranker Wall | Selected students (toppers) by year, with photo, school and rank. |
| 🖼️ Gallery | Photos of the campus and activities. Upload one at a time or many together. |
| ▶️ Videos | YouTube videos shown on the website. |
| 📰 Blog/News | Articles and news posts. |
| ⭐ Reviews | Reviews shown on the website. You can show or hide each one. |
| 📄 Papers | Previous question papers with PDF links. |
| 🎉 Result Banners | Result celebration banners on the website. |
| 👨‍🏫 Faculty | Teachers and staff shown on the website, with bulk photo upload. |
| 🏫 Facilities | Facilities of the institute with icon, text and key points. |
| 📝 Mock Tests | Mock tests listed on the website. |
| ❓ FAQs | Questions and answers for visitors. |
| 💬 Testimonials | Parent quotes shown on the website. |
| 🗓️ Exam Calendar | Exam application and exam dates. |
| 📌 Timeline | Step-by-step timeline items with date and status. |
| ⚙️ Settings | Admission dates, fee payment details, homepage numbers, founder section, results and social media links. |

**How to…**

#### 30.1 Check and answer website enquiries

1. Open the "📬 Enquiries" tab.
2. Read the top numbers: Total, Today, This Week, Unread, Grievances.
3. Use the search box or the list "All Enquiries / Unread Only / Admissions / Grievances".
4. Click an enquiry to open the details.
5. Press "📱 WhatsApp" or "📞 Call" to contact the parent.
6. After you reply, press "✓ Mark Replied".

> 💡 A Grievance shows a red banner: "Requires response within 48 hours". Answer these first. Press "⬇ Export CSV" to download the list.

#### 30.2 Publish a notice

1. Open the "📣 Notices" tab.
2. Fill "Title *", choose "Priority" (High, Medium or Low) and the "Date".
3. Write the text in "Body *".
4. Press "Publish to Website →".
5. Later you can press "Edit", "Archive" (or "Restore") or "Delete" on a notice.

> 💡 The "📢 Latest Scrolling Strip" card controls the moving text on the website. Press "💾 Save Strip" after you change it.

#### 30.3 Add a topper to the Ranker Wall

1. Open the "🏆 Ranker Wall" tab.
2. Choose "Session / Year *".
3. Fill "Student Name *" and "School Selected *". "Rank / Achievement" and "Batch label" are optional.
4. Press "Upload Photo" under "Student Photo".
5. Press "Add to … Toppers →".

#### 30.4 Add photos to the Gallery

1. Open the "🖼️ Gallery" tab.
2. For many photos: choose the Category, then press "Select Multiple Photos →". All photos get the same category.
3. For one photo: under "➕ Add Single Gallery Image", upload the photo, fill Caption and Category, then press "Add to Gallery →".
4. To change a caption later, edit it in the grid. Press "Remove" to delete a photo.

#### 30.5 Add an event, a video or a news post

1. Events: open "📅 Events", fill "Event Title *" and "Date *", choose "Visible on Website", then press "Add Event →".
2. Videos: open "▶️ Videos", fill "Video Title *" and "YouTube URL", then press "Add Video →".
3. News: open "📰 Blog/News", fill "Title *" and "Body *", add a cover image if you want, then press "Publish Post →".
4. Use "Hide"/"Show" or "Unpublish"/"Publish" to control what visitors see.

#### 30.6 Add faculty with many photos at once

1. Open the "👨‍🏫 Faculty" tab.
2. Under "Bulk Upload Staff Photos", press "Select Multiple Photos →".
3. Photos are matched by file name to staff (for example "Himan Singh.jpg").
4. Assign any unmatched photo, or add it as new faculty, then press "Save All".
5. For one person use "➕ Add Faculty": fill "Full Name *" and "Role / Designation *".

#### 30.7 Update admission dates and fee payment details

1. Open the "⚙️ Settings" tab.
2. Edit the fields in the groups: Admissions, Fee Payment, Homepage Stats, Founder Section, Results & Achievements and Social Media.
3. Press "💾 Save All Settings".

> 💡 Check the bank account number and UPI ID twice. Parents will pay using them.

**Good habits**

- Most items have "Edit", "Hide/Show" and "Delete". Hide an item if you may need it again.
- Use the "Sort Order" or "Order" field to decide which item comes first.
- The website updates live. Check spelling before you press Publish or Add.

**Common mistakes**

- Deleting an item when you only want to hide it → use Hide, Unpublish or Archive. Delete asks to confirm and cannot be undone.
- Forgetting to press the save button (for example "💾 Save All Settings" or "💾 Save Strip") → the change is not saved.
- Leaving a required field (marked *) empty → fill every field with a star.
- Not replying to a grievance → grievances must be answered within 48 hours.

**Questions people ask**

- **How long until the website shows my change?** The page says data syncs live to the landing page. Refresh the website to check.
- **What is the difference between Hide and Delete?** Hide keeps the item but visitors cannot see it. Delete removes it for ever.
- **A section shows an error or is empty. Why?** Some sections need a database table to be created once. Use the "Copy SQL" button and give it to the Admin or IT person.
- **Where do I see enquiries from the website?** In the "📬 Enquiries" tab. Unread ones are counted at the top.

### 31. Store

_Used by: Store, Admin_

The campus shop for uniforms, books and hostel items. Use it to bill customers at the counter, manage stock, handle online orders and see sales reports. Every sale is posted to Accounts as income.

**Before you start**

- Products must be added with a selling price and stock. Only Admin can add or edit products.
- If you see "Store tables not ready", the store database setup has not been run. Tell the Admin.
- For a student bill, the student must already be in the Students module.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 🛒 Counter POS | Billing screen. Search or scan items, make the bill, take payment, print the bill. |
| 📦 Products & Stock | List of products with stock. Export CSV and print labels. Admin can add, edit, change stock, import, stock take and bulk price. |
| 🌐 Online Orders | Orders placed by parents on the online store. Confirm, pack, mark ready and bill them. A number shows new orders. |
| 🧾 Sales | All bills. Reprint a bill, receive money for a due bill, make a return, void a bill, and do Day close. |
| 📥 Purchases | Admin only. Record stock received from suppliers and send a purchase order. |
| 🎒 Kits | Admin only. Make a kit (a group of items bought together) that can be added to a bill in one tap. |
| 🏷️ Promotions | Admin only. Promo codes and loyalty points. |
| 📊 Reports | Sales trend, best sellers, top products, collections by mode and staff, category sales, low stock and customers. |

**How to…**

#### 31.1 Make a bill at the counter

1. Open the "🛒 Counter POS" tab.
2. Search an item in "Search item or scan barcode", or tap a category and then the product. Press 📷 Scan to use the camera.
3. Tap an item again to add more. Use + and − on the bill to change quantity.
4. Choose the customer: "🚶 Walk-in" or "🎓 Student". For a student, type the name or GCC No. and pick the student.
5. Check the bill on the right. Then press the pay button.
6. Type who is billing in "Billed by" if it is empty. It is required.
7. Choose how the customer pays: Cash, UPI, Card, Bank Transfer or Cheque.
8. For Cash, tap the cash received. The screen shows the change to give.
9. For UPI, Card, Bank Transfer or Cheque, type the reference number. It is required.
10. Press the complete button. "SALE COMPLETE" shows. Press "🖨 Print bill" if needed, then "New sale".

> 💡 An item with no stock cannot be added. You also cannot add more than the stock available.

#### 31.2 Put a bill on hold

1. While a bill is open, press "⏸ Hold" to keep it aside and serve the next customer.
2. Held bills show at the top as "ON HOLD".
3. Tap a held bill to bring it back. Press × to throw it away.
4. Press "✕ Clear" to empty the current bill.

#### 31.3 Sell to a student on dues (part payment)

1. Choose "🎓 Student" and select the student.
2. Open the payment screen.
3. In "Paying now ₹", type the amount paid today. Type 0 to put everything on dues.
4. Complete the sale. The screen shows "Added to student dues".
5. Later, open the "🧾 Sales" tab and press "Receive" on that bill. Enter the amount, the mode and the reference.

> 💡 Part payment is allowed only for a student. For walk-in customers the full amount must be paid.

#### 31.4 Discounts, promo code and points

1. On the bill, press "🏷 Promo code", type the code and press the check button. The discount is applied if the code is valid.
2. Only Admin sees the "₹ Discount" button. Admin can type a rupee amount or press 5% or 10%.
3. For a student with loyalty points, press "⭐ Use points" and type the points, or press "Use max".

#### 31.5 Handle an online order

1. Open the "🌐 Online Orders" tab. New orders are in "New".
2. Press the button on the order to move it to Confirmed, then Ready for pickup.
3. To do many together, tick orders and press "Mark confirmed" or "Mark ready". You can print a pick list or packing slips for ticked orders.
4. When the parent comes, press the "Bill ..." button on a Ready order to make the bill.
5. To cancel, press the cancel button on the order and confirm.

> 💡 "🔔 Order alerts on" at the top gives a sound and a notification for new orders.

#### 31.6 Receive a return

1. Open the "🧾 Sales" tab and find the paid bill.
2. Press "↩ Return" (Admin only).
3. Choose the quantity to return for each item.
4. Type the Reason. It is required.
5. Choose "Refund via" and confirm.
6. Returned stock goes back on the shelf. For an exchange, do the return first, then bill the new item in POS.

#### 31.7 Void a wrong bill (Admin only)

1. Open the "🧾 Sales" tab.
2. Press "Void" on the bill.
3. Type the reason. It is required.
4. Stock is put back and the Accounts entry for the bill is removed.

> 💡 A bill that already has a return cannot be voided.

#### 31.8 Add stock or close the day

1. To change stock for one product (Admin): "📦 Products & Stock", press "± Stock", type a whole number (use minus to reduce).
2. To receive new stock (Admin): "📥 Purchases", press "📥 Receive stock (new purchase)", pick the Supplier, add items with quantity, and save.
3. For the end of the day: "🧾 Sales", press "🧮 Day close". Enter the Opening float and count the cash. It shows the Expected in drawer, Counted and Variance.

**Good habits**

- Use the Enter key in the search box to add an exact barcode or SKU match quickly.
- The "Low stock" box at the top and the "Reports" tab show items that need to be re-ordered.
- In Purchases, the re-order list can add all low-stock items to a purchase in one press.
- "📣 Stock requests" shows parents waiting for an item to come back in stock.

**Common mistakes**

- Billing a student without selecting the student → The sale is stopped. Choose the student first.
- Leaving the UPI/Card reference empty → The sale cannot be completed. Type the reference number.
- Voiding a bill without a reason → A reason is required.
- Counting the cash but not the float in Day close → Enter the Opening float so the expected cash is right.

**Questions people ask**

- **Where does store income appear?** Each sale is posted to Accounts automatically as income. If a message says posting to Accounts failed, tell the Admin.
- **Why do I not see Purchases, Kits, Promotions or the Discount button?** They are for Admin only.
- **How do I add a product with many sizes?** Admin: "📦 Products & Stock", "+ Add product", fill "Sizes (comma separated)" and "Opening stock (each size)". One product is made for each size.
- **Can I give a refund without a bill?** No. Returns are made against a bill from the Sales tab.

### Management & Administration

### 32. Reports

_Used by: Admin, Accountant, Reception_

Make a list report from almost any part of the ERP (students, fees, staff, hostel and more). You can filter it, see charts, and download it as PDF, Excel, CSV or Word, or print it.

**Before you start**

- You need permission to open the Reports module. Ask the Admin if you cannot see it in the sidebar.
- The data must already be entered in the other modules. A report only shows what is already saved.

**Screens in this module**

| Screen | What it is for |
|---|---|
| ⚡ Quick Presets | Ready-made reports (for example Fee Defaulters, Active Students, Boarders) and your own saved reports. |
| 📂 Report Source & Filters | Choose the data source, then set Search, Status, Date From, Date To, Group By and the Columns. |
| 📋 Table | Shows the report rows page by page. Click it after pressing Generate Report. |
| 📊 Charts | Shows the same report as charts (Status Distribution, and Records by the Group By column). |
| Letterhead | Top button. Opens "🏫 Institute Header" to set the institute name, address, phone, logo and watermark used in downloads. |
| History | Top button. Opens "📋 Report History" showing the reports you made on this device. |

**How to…**

#### 32.1 Make a report from a ready-made preset

1. Open "Reports" from the sidebar.
2. Under "⚡ Quick Presets", click a preset such as "⚠️ Fee Defaulters" or "🏠 Boarders".
3. Click "🔄 Generate Report".
4. The rows appear in the "📋 Table" view.

> 💡 Clicking a preset only sets the filters. You must still press "🔄 Generate Report".

#### 32.2 Make your own report

1. Under "📂 Report Source & Filters", click a source button (for example "🎓 Students" or "💰 Fees"). The sources are grouped as Students & Admissions, Finance, Academic & Staff, and Hostel & Admin.
2. Type in "Search" to find any word in the rows.
3. If shown, choose "Status", "Date From" and "Date To".
4. If shown, choose "Group By" to group rows (for example by department).
5. Tick or untick the Columns you want. Drag a column chip to change the order.
6. Click "🔄 Generate Report".

#### 32.3 Download or print the report

1. Generate the report first.
2. Click one of the buttons: "📄 PDF", "📊 Excel", "📁 CSV", "📝 Word" or "🖨️ Print".
3. Open the downloaded file from your browser downloads.

> 💡 Click a column heading in the table to sort by that column.

#### 32.4 Set the school header for PDF and print

1. Click "Letterhead" at the top.
2. Fill "Institute Name", "Address" and "Phone".
3. Use "Upload Logo" to add a logo. Click "Remove" to take it out.
4. Choose a "Watermark": None, CONFIDENTIAL, DRAFT or INTERNAL.

#### 32.5 Save a report setup to use again

1. Set your source and filters the way you want.
2. Click "+ Save Preset".
3. Type a name in "Preset name…" and click "Save".
4. Your preset appears in Quick Presets. Click the "✕" next to it to delete it.

> 💡 Saved presets are kept in this browser only.

#### 32.6 See the past reports

1. Click "History" at the top.
2. See the last reports you made (up to 50).
3. Click "Clear All" to empty the list.

**Good habits**

- Use "▲ Collapse" to hide the filters and see more of the table.
- The top boxes show Total Records, Positive, Pending / Other and, for some sources, a rupee total.
- Use the page buttons at the table bottom when there are many rows.

**Common mistakes**

- Changing filters and expecting the table to change → press "🔄 Generate Report" again.
- Downloading before generating → the table is empty. Generate first.
- Expecting your saved presets on another computer → presets, history and the letterhead are saved on this device only.

**Questions people ask**

- **Why is my report empty?** Check the Status, dates and Search box. Remove filters and press "🔄 Generate Report" again.
- **Can I choose which columns go in the file?** Yes. Tick only the Columns you need before pressing Generate Report.
- **Does it show more than 1000 rows?** Yes. The report reads all rows of the source, not only the first 1000.

### 33. Checklist

_Used by: Admin, Teacher, Any staff_

Track exams and events step by step. An Admin or In-charge gives a checklist to a staff member. The staff member finishes each step, and the In-charge or Admin approves it.

**Before you start**

- Your staff profile must be linked to your login (see Link Staff). Otherwise the page cannot find your checklists.
- Your role decides what you can do: Staff do the steps, In-charge and Admin assign, approve and sign off.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 🏠 Dashboard | A quick summary of your checklists and pending work. |
| 📋 Exams | Exam checklists: Monthly Test, Pre Mock Test and Mega Mock Test. |
| 📅 Events | Event checklists: Annual Day, Sports Day, Cultural Event, Parent-Teacher Meeting, Independence / Republic Day, Admission Camp / Open Day, Other. |
| 🗂️ Records | Completed (signed off) exams and events, with the full step history. You can export it as CSV. |
| 📊 Monitor | Staff progress and recent activity. Only Admin and In-charge see this tab. |

**How to…**

#### 33.1 Assign an exam checklist (Admin / In-charge)

1. Open the "📋 Exams" tab.
2. Press "＋ Assign".
3. Choose "👤 Single Staff" or "👥 Bulk Assign".
4. Pick the Exam Type: Monthly Test, Pre Mock Test or Mega Mock Test.
5. Type a Title (optional) and choose the Exam Date.
6. Admin can also choose the Department.
7. Choose the person in "Assign To", or tick many staff for bulk. "Select All" is available.
8. Press the save button at the bottom.

> 💡 In bulk mode, each person's name is added to the title automatically.

#### 33.2 Assign an event checklist (Admin / In-charge)

1. Open the "📅 Events" tab.
2. Press "＋ Assign Event".
3. Pick the Event Type and fill Title and Event Date.
4. Fill "Venue / Location" and "Notes" if needed.
5. Choose the staff member(s) and save.

#### 33.3 Finish a step (Staff)

1. Open the "Exams" or "Events" tab and find your checklist.
2. Press the "Steps — Open" button on the card.
3. Click the step that says "Active". Later steps are locked until earlier ones are approved.
4. Write what you did in the "Completion note" box. The note is compulsory.
5. Press "Submit for review →".
6. The step shows "Awaiting Review" until the In-charge or Admin checks it.

> 💡 If a step is "Rejected", read the rejection reason, fix the work and submit again.

#### 33.4 Approve or reject a step (Admin / In-charge)

1. Open the checklist. Cards with work waiting show an orange button.
2. Click the step with "Awaiting Review".
3. Read the staff note.
4. To accept, write optional feedback and press "✓ Approve".
5. To send it back, you must write a reason in the Feedback box and press "✕ Reject".

#### 33.5 Sign off a finished checklist (Admin / In-charge)

1. Approve every step first.
2. Open the checklist. The bottom shows "Approve all steps to enable final sign-off" until all steps are approved.
3. Press "🏁 Final Sign-off — Complete".
4. The checklist moves to the "🗂️ Records" tab as Finalized.

#### 33.6 Find old records and export

1. Open the "🗂️ Records" tab.
2. Use the search box, the type drop-down (All Types / Exams Only / Events Only), the month picker, or "Filter by staff…".
3. Click a record to see who assigned it, who finalized it, and the step audit trail.
4. Press "⬇ Export CSV" to download the list.

**Good habits**

- The "⏳ Pending" button at the top shows how many steps wait for review. Click it to go to them.
- The small coloured dots on a card show each step: grey is pending, blue is in progress, orange is awaiting review, green is approved, red is rejected.
- Press 🔄 at the top to refresh.

**Common mistakes**

- Submitting a step without a note → the system asks for a completion note. Write what was done.
- Rejecting without a reason → a reason is required. Explain what must be fixed.
- Trying to skip a step → steps are in order. Only the first non-approved step is active.
- Deleting a checklist by mistake → delete (🗑) asks to confirm "Delete this item?". It cannot be undone, so read carefully.

**Questions people ask**

- **Why can I not see the Assign button?** Only Admin and In-charge can assign checklists. Staff can only do the steps given to them.
- **Who can delete a checklist?** Admin can delete any checklist. An In-charge can delete only those in their own department. A finalized checklist cannot be deleted.
- **Why do I see only some checklists?** Staff see only the ones assigned to them. In-charge see their department. Admin sees all.
- **Who counts as In-charge?** Staff whose role is In-charge, Manager, Coordinator, HOD, Head of Department, Supervisor or Superintendent.

### 34. Invitation

_Used by: Admin_

Design and print an event invitation. It makes two A5 cards on one A4 landscape page: Page 1 is the invitation and Page 2 is the programme.

**Before you start**

- Only Admin and Manager can use it. Other roles see "Admin / Manager Access Only". The Admin must also give permission to this module.
- Have the event details ready: title, date, venue, chief guests, and the programme items with times.

**Screens in this module**

| Screen | What it is for |
|---|---|
| Page 1 | Editor panel for the invitation card: institute name, address, opening line, event title, date, venue, anchor, guests and quote. |
| Page 2 | Editor panel for the programme card: section title, date, start time, venue note and the list of programme items. |
| Fonts | Change the font size of each text and the font style. |
| Colors | Panel "Colors & Print": change card colours and turn on "Less Ink Mode". |

**How to…**

#### 34.1 Open the studio and the editor panels

1. Click "Invitation" in the sidebar.
2. In the top bar, under "Editor", click "Page 1", "Page 2", "Fonts" or "Colors".
3. The panel opens on top of the preview. Click the same button again to close it.
4. The two cards show live in the preview as you type.

> 💡 You can open more than one panel at the same time.

#### 34.2 Edit the invitation card (Page 1)

1. Open the "Page 1" panel.
2. Change the institute "Name", "Address" and "Script" lines.
3. Edit "Opening Line" and "Event Title".
4. Fill the date: "Month", "Day", "Ord" and "Year".
5. Fill "Venue" and its "Note".
6. Fill the anchor "Name" and "Role".
7. Click "+ Add Member" to add a guest with a name and a role. Click "✕" to remove one.
8. Edit the "Quote" at the end if you want.

#### 34.3 Edit the programme card (Page 2)

1. Open the "Page 2" panel.
2. Fill "Section Title", "Date", "Start Time" and "Venue Note".
3. Click "+ Add Item" to add a programme item with time, name and sub text. Click "✕" to remove one.
4. Fill "Footer Left" and "Footer Right".

#### 34.4 Change fonts and colours

1. Open the "Fonts" panel to change the size of the texts.
2. Open the "Colors" panel to change "Background / Navy", "Primary Gold" and "Light Gold".
3. Press "Reset Colors" to return to the original colours.
4. Turn on "Less Ink Mode" to use white backgrounds and save toner.

#### 34.5 Print the invitation

1. Check the spelling of both cards in the preview.
2. Press "⎙ Print / PDF".
3. A new window opens and the print dialog appears.
4. Choose your printer, or choose "Save as PDF".

> 💡 The page size is A4 Landscape (297 × 210 mm) with two A5 cards. If the print window does not open, allow pop-ups for this site.

#### 34.6 Save your work and reload it later

1. In the top bar, choose a slot: "Slot A", "Slot B" or "Slot C".
2. Press "💾 Save".
3. Later, choose the same slot and press "📂 Load".
4. Press "⬇ Export" to download the cards as an HTML file.

> 💡 Saved slots are kept in this browser only. They will not show on another computer.

**Good habits**

- Use the Zoom slider in the top bar to make the preview bigger or smaller. "Reset" in that box returns to the normal size.
- Use the fullscreen button to see the cards bigger. Press Esc to leave fullscreen.
- The minimise button hides the top bar for a full preview. Click the thin gold line at the top to bring it back.

**Common mistakes**

- Saving into the wrong slot → the old design in that slot is replaced. Use a different slot for each event.
- Changing the text but not checking the other card → check both Page 1 and Page 2 before printing.
- Expecting saved slots on another computer → they are saved in this browser only. Use "⬇ Export" to keep a file.

**Questions people ask**

- **Why do I see "Admin / Manager Access Only"?** Your role cannot use this module. Ask the Admin.
- **Does "Load" bring back my design after I close the browser?** Yes, if you saved it in a slot on the same browser and did not clear the browser data.
- **Can I print only one card?** No. The print puts both cards on one A4 landscape page.

### 35. Certificates

_Used by: Admin, Reception_

Make and print batch achievement certificates for students (Navodaya and Sainik groups). You pick a student, check the details, and print or save as PDF.

**Before you start**

- You need permission for this module. Admin and Manager can always open it. Other staff need "read" permission, or they see "Access Denied".
- Have the correct student names, school names and addresses ready.

**Screens in this module**

| Screen | What it is for |
|---|---|
| ⊙ Student | Choose a Batch List, pick a student from the list, and edit name, salutation, batch, group, selected school and address. |
| ✎ Certificate | Edit the Exam / Programme, Award Line and Year / Session text. |
| ✒ Signatures | Change the name and title of the two signatories. |
| Aa Typography | Change the font and size of the institution name, student name and body text. |
| ⊞ Logos | Upload left, centre and right logos, and set the logo size and shape. |
| ◈ Templates | Pick a ready-made look: Classic Gold, Royal Navy, Emerald, Crimson, Midnight or Antique. |
| 🎨 Design | Change colours, background, border and spacing of the certificate. |
| ⚙ Advanced | Extra CSS, the Element Inspector, scale and filters, and the Print / Save PDF, Save as PNG and Copy HTML options. |

**How to…**

#### 35.1 Open the generator

1. Click "Certificates" in the sidebar under MANAGEMENT.
2. Wait for "Loading Certificate Generator…" to finish.
3. The editor opens on the left side. Press the ✦ button to open or close it.

> 💡 If the page does not load, press "↺ Reload" at the top right.

#### 35.2 Make a certificate for one student

1. Open the "⊙ Student" tab.
2. In "Batch List", choose the right list (for example "JNV – 9th Batch (2026-27)").
3. Click the student in the list.
4. Check "Full Name", "Salutation", "Batch", "Group / Stream", "Selected School / JNV" and "Address".
5. Press "✎ Apply Changes" to see the changes on the certificate.

#### 35.3 Change the wording of the certificate

1. Open the "✎ Certificate" tab.
2. Edit "Exam / Programme", "Award Line" and "Year / Session".
3. Press "✎ Apply Changes".

#### 35.4 Change the signatures

1. Open the "✒ Signatures" tab.
2. Edit the "Name" and "Title" for signature 1 and signature 2.
3. Press "✎ Apply Changes".

#### 35.5 Change the look

1. Open the "◈ Templates" tab and click a template card.
2. To fine-tune, open the "🎨 Design" tab and change the colours or border.
3. Press "↺ Live Preview" to see it. Press "↺ Reset" to go back.

#### 35.6 Print or save

1. Check the certificate on screen first.
2. Press "⎙ Print / PDF" and choose a printer or "Save as PDF".
3. Use the "◀" and "▶" buttons to go to the previous or next student.
4. For a picture file, open the "⚙ Advanced" tab and press "⬇ Save as PNG".

> 💡 In the Advanced tab, "Print Scale" has "100% — A4", "85% — Fit A4" and "75% — Compact" if the page does not fit.

#### 35.7 Edit many students at once

1. Press "⊞ Bulk Edit" in the Student tab.
2. Use the tabs "Students", "Common Fields", "Find & Replace" or "CSV Import".

**Good habits**

- Always scroll through the certificate and check each spelling before printing.
- Use "⛶ Fullscreen" at the top to see a bigger preview.
- Always press "✎ Apply Changes" after typing, or the certificate will not update.

**Common mistakes**

- Printing before checking the name spelling → check the name, school and address on screen first.
- Forgetting to press "✎ Apply Changes" → press it after every edit.
- Choosing the wrong Batch List → the student names come from that list, so pick the right one first.

**Questions people ask**

- **I see "Access Denied". What do I do?** You do not have permission for this module. Ask the Admin to give you access.
- **The page shows "Could not load certificate.html".** Press "↺ Reload". If it still fails, tell the Admin or the IT person.
- **Can I add a school logo?** Yes. Open the "⊞ Logos" tab and press "↑ Upload" for the left, centre or right logo. Press "✕" to remove it.

### 36. Admin

_Used by: Admin_

The control room of the ERP. Admin creates staff logins, sets what each role can see and do, gives special access to one person, and checks who used what.

**Before you start**

- Only Admin, Administrator and Co-Admin can open this page. Others see "Access Denied".
- Add staff in the Staff module first if you want to link a login to a staff profile.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 👥 Users | Add, edit, disable, enable or delete portal logins. |
| 🛡️ Permissions | Choose which modules and actions (Read, Add, Edit, Delete) each role has. |
| ⚡ Overrides | Give or remove access for one single user, different from their role. A reason is required. |
| 📊 Analytics | Charts of how much each module and role is used. |
| 🗂️ Access Logs | A list of who opened which module and when. You can search, filter and export to CSV. |
| 🔑 Password | Change the Admin password. |
| 📋 Audit | History of important actions done in the portal. |
| 🏬 Store | Opens the Store screen inside Admin, with a link to the public storefront. |
| 🌐 Website | The Website Manager screen inside Admin. |
| 🧠 Intelligence | Extra insight screen for the Admin. |
| 🩺 360° Health | Security and health overview of the system. |

**How to…**

#### 36.1 Add a new user login

1. Open the "👥 Users" tab.
2. Press "+ Add User".
3. Fill "Full Name *", "Username *" and "Password * (min 8 chars)".
4. Choose the "Role".
5. In "Link Staff Profile" choose the staff member, or leave "— Not linked —".
6. Press "Add User".

> 💡 The username is saved in small letters and cannot be changed later. If it is taken you see "Username already taken."

#### 36.2 Edit, disable or delete a user

1. In the "👥 Users" tab, find the person. Use the role buttons or the "🔍 Search by name or username…" box.
2. Press "Edit" to change the name, role, linked staff, or set a new password. Leave the password blank to keep the old one.
3. Press "Disable" to stop the person from logging in. Press "Enable" to allow it again.
4. Press "Delete" and confirm to remove the user for ever.

> 💡 You cannot disable or delete your own account, and you cannot remove the last active admin.

#### 36.3 Set permissions for a role

1. Open the "🛡️ Permissions" tab.
2. Click a role at the top (for example Teacher or Accountant).
3. In the table, switch on 👁 Read, ➕ Add, ✏️ Edit and 🗑 Delete for each module.
4. To start from another role, choose it in "Copy from role:" and press "Copy". This is not saved until you press Save.
5. "✓ All" selects everything. "✗ Clear" removes everything.
6. Press "💾 Save". It shows "✓ Saved!".

> 💡 You can switch between "⊞ Matrix" and "▦ Cards" view.

#### 36.4 Give special access to one person (Override)

1. Open the "⚡ Overrides" tab.
2. Click the user in the "SELECT USER" list.
3. Type a reason in "Reason for override". It is required.
4. Click the Read, Add, Edit or Delete switch for a module. The override is saved at once.
5. To go back to the role default, press the reset (remove) button on that row.

> 💡 An override works only for that user and beats the role permission. Write a clear reason, for example "Temporary access for audit period".

#### 36.5 Change the Admin password

1. Open the "🔑 Password" tab.
2. Fill "Current Password", "New Password" (at least 8 characters) and "Confirm New Password".
3. Press "🔑 Change Password".
4. You see "Password changed successfully."

> 💡 If the page says you are still on the default password, change it now.

#### 36.6 Check who used the system

1. Open "🗂️ Access Logs" to see who opened which module. Use the search box and the "All Modules" and "All Roles" lists.
2. Press the export button to download a CSV file.
3. Open "📋 Audit" to see the history of changes. Filter by type or by user.

> 💡 Access Logs shows the latest 500 entries.

**Good habits**

- Start with permissions by role. Use Overrides only for exceptions.
- After you Save a role, ask users to log in again if they do not see the change.
- The Admin page logs you out after you are idle. A warning appears first, with a "stay logged in" option.

**Common mistakes**

- Changing permissions and leaving without pressing "💾 Save" → nothing is saved. Press Save.
- Pressing "Copy" and thinking it is saved → Copy only fills the table. You must still press Save.
- Deleting a user when you only want to stop their access → use "Disable" instead. Delete cannot be undone.
- Trying an override without a reason → it will not save. Type the reason first.
- Removing the Admin role from yourself or the last admin → the system blocks it.

**Questions people ask**

- **A staff member cannot see a module. What do I do?** Open Permissions, select their role and switch on Read for that module, then Save. For only one person, use Overrides.
- **What is the difference between Disable and Delete?** Disable stops login but keeps the user, and you can Enable later. Delete removes the user for ever.
- **What does "Link Staff Profile" do?** It connects the login to the staff profile. The page says it is used for Geo-Attendance.
- **I forgot a staff member's password.** Open Users, press Edit on that person and type a new password (at least 8 characters), then save.

### 37. Student 360°

_Used by: Admin_

See everything every module has recorded about one student on a single screen (profile, fees, attendance, exams, hostel and more). It also finds and helps fix records that do not match between modules. Admin only.

**Before you start**

- Only Admin accounts can open it. Others see "Admin access only".
- The student must already exist in the Students module.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 🔍 Search Student | Find one student and see their full record from all modules. |
| 🌐 Global Search | Search a word, receipt number, phone number or note across every module. |
| 🧠 Admin Intelligence | Extra insight screen for the Admin. |
| 📊 Mismatch Dashboard | A list of records that disagree between modules, with Fix, Acknowledge and Resolve actions. |
| 🏫 School Overview | School-wide numbers: enrollment by course, students by house, fee collection, hostel occupancy, and fee defaulters. |
| 🗄️ Table Browser | Browse the raw tables of the system. |

**How to…**

#### 37.1 Look up one student

1. Open "Student 360°" and stay on "🔍 Search Student".
2. Type in "Search by name, GCC No, admission no, or batch…".
3. Click the student in the results.
4. Wait for "Pulling records from every module…".
5. Read the top card, the summary strip and the charts (attendance, exam marks, fee breakdown).

#### 37.2 Read the sections of a student

1. Scroll to the section cards: Student Profile, Admission Record, Fees, Attendance, Exam Marks, Hostel, Discipline, Sickbay, Leave Records, Gate Passes, Enquiries & Parent Items and Complaints.
2. Click a card to open it. Or press "⬇ Expand All" to open all cards, and "⬆ Collapse All" to close them.
3. Some cards have a link to the full module (for example Students, Fees, Hostel). Click it to go there.
4. Press "⬇ CSV" on a card to download that data.

#### 37.3 Correct a field in the student record

1. Find the field in a section such as Student Profile or Hostel.
2. Click the small ✎ pencil next to the value.
3. Type or choose the new value.
4. Press "Save", or "Cancel" to stop.

> 💡 Only fields that the system allows are editable. Changes are saved in the real record, so other modules show the new value too.

#### 37.4 Alert the admin about mismatches

1. When a student has mismatch flags, a flag list shows under the charts.
2. Press "🔔 Notify Admin" to log the flags.
3. The button then says "✓ Admin notified". If the flags were already logged it says "Already flagged — no new alert sent".

#### 37.5 Work through the Mismatch Dashboard

1. Open the "📊 Mismatch Dashboard" tab.
2. Read the top numbers: Total open, Critical, Warning, Students affected, Unacknowledged.
3. Filter by name or GCC, severity, status or issue type. Press "↻ Refresh" to reload.
4. On a row, press "✎ Fix …" to correct the value right there (then "Save"), or open the student.
5. Press "Acknowledge" to say you have seen it, or "Resolve" when it is fixed.

> 💡 Start with the Critical items.

#### 37.6 Search across the whole system

1. Open the "🌐 Global Search" tab.
2. Type at least 2 letters or numbers (a receipt number, phone number, gate pass reason, discipline note…).
3. Press "Search" or Enter.
4. Use the filter buttons to narrow by module. Click a result to open the student or the module.

#### 37.7 See school-wide numbers and fee defaulters

1. Open the "🏫 School Overview" tab.
2. Read the cards: Enrollment by Course, Students by House, Fee Collection Summary, Hostel Occupancy by House and Students With No Fee Payment On Record.
3. In "Fee Defaulters (Exact Amounts Owed)", press "Compute Exact Dues" and wait.

> 💡 Compute Exact Dues checks every active student, so it takes some time.

**Good habits**

- Use this page to check a student before calling the parents, so you see fees, attendance and exams in one place.
- Green and red colours on the cards show if something is fine or needs attention (for example attendance under 75% shows red).
- Click a student name in dashboards to jump straight to their full record.

**Common mistakes**

- Editing a value without checking the other modules → the same fact may be wrong elsewhere. Look at the mismatch flags too.
- Marking a mismatch "Resolve" before fixing it → fix it first with the "✎ Fix" button.
- Using Backfill and Cleanup buttons without need → read the message first. They change hostel allocation records for many students.

**Questions people ask**

- **Why can I not open this module?** It is for Admin accounts only. Ask the Admin.
- **What does the Backfill button do?** It appears when students have a house but no allocation record. "⚡ Backfill house allocations" creates the missing allocation records after you confirm.
- **What is "🧹 Remove Dayscholar allocation rows"?** It removes hostel allocation rows wrongly created for day scholars. It does not touch real boarding allocations.
- **Where do I change fees or attendance in full?** Use the link on the card to open the real module, such as Fees or Attendance.

### 38. System

_Used by: Admin_

The settings page for the whole ERP: school details, login rules, colours and logo, alerts, academic settings, data tools and integrations. Only Admin can use it.

**Before you start**

- Only Admin, Administrator and Co-Admin can open it. Others see "Access restricted".
- Be careful. Changes here are saved for the whole school.

**Screens in this module**

| Screen | What it is for |
|---|---|
| 🏫 Basic Info | School name, address, phone, email, principal, year established, academic session, institute type and affiliation. |
| 🔒 Security | Idle logout, maximum login attempts, lockout time, and the password reminder box. |
| 🎨 Appearance | Colour presets, Primary / Sidebar / Accent colours, font family, portal title, logo and favicon. |
| 🔔 Notifications | SMS, WhatsApp and Email (SMTP) settings and alert on/off switches. |
| 📚 Academic Config | Academic year, fee due day, attendance threshold, and the lists of Classes / Batches and Courses / Streams. |
| 🗄️ Data Mgmt | Database Health Check, Import Students from CSV, and Clear Module Data for logs. |
| 🔗 Integrations | Razorpay, Google Workspace, Portal API Key and Supabase Project URL. |

**How to…**

#### 38.1 Update the school details

1. Open "System" and stay on "🏫 Basic Info".
2. Edit "School / Institute Name", "Address", "Phone", "Email", "Principal Name" and "Year Established".
3. In "Academic & System Info", set "Academic Session" (for example 2025-2026), "Institute Type" and "Affiliation / Board".
4. Press "Save Changes". It shows "✓ Saved!" when done.

> 💡 These details are used in fee receipts, reports and other printed documents, so keep them correct.

#### 38.2 Set login rules

1. Open the "🔒 Security" tab.
2. Set "Idle Logout (minutes — blank or 0 = off)".
3. Set "Max Login Attempts" and "Lockout Duration (minutes)".
4. Press "Save Changes".

> 💡 The toggles "Force Password Change" and "Two-Factor Required" are saved, but the page says they are not enforced yet.

#### 38.3 Change colours, font, logo and title

1. Open the "🎨 Appearance" tab.
2. Click a colour preset, or pick your own Primary, Sidebar and Accent colours.
3. Choose a font in "Font Family".
4. Under "Branding", fill "Portal Title", "Logo URL" and "Favicon URL". The URL must start with https://.
5. Press "Save Changes".

#### 38.4 Set academic settings

1. Open the "📚 Academic Config" tab.
2. Fill "Year Start", "Year End", "Fee Due Day (of month)" and "Attendance Threshold (%)".
3. Press "Save Changes".
4. To change the lists, type a name in "Add class…" or "Add course…" and press "Add". Remove one with the cross on its tag.

> 💡 The Classes / Batches list is only a reference. Real classes and fees come from Courses and Fee Setup.

#### 38.5 Check the database

1. Open the "🗄️ Data Mgmt" tab.
2. Press "Run Health Check".
3. Wait. Each table shows a green "rows" count, or a red error.

#### 38.6 Import students from a CSV file

1. Open the "🗄️ Data Mgmt" tab.
2. Press "📂 Choose CSV File" and select your .csv file.
3. Wait for the result message. It tells how many students were imported and how many duplicates were skipped.

> 💡 Students with an admission number that already exists are skipped. New students are saved with status Active.

#### 38.7 Clear old logs (irreversible)

1. Open the "🗄️ Data Mgmt" tab and go to "🗑️ Clear Module Data".
2. Press "Clear" next to Audit Logs, Fraud Events or Backup Logs.
3. Type the exact table name in the box that opens.
4. Press "Clear table". All rows in that table are deleted for ever.

#### 38.8 Set up Razorpay or Google

1. Open the "🔗 Integrations" tab.
2. Turn the switch on for Razorpay or Google Workspace.
3. Fill the keys (they are hidden by default).
4. Press "Save Changes".

> 💡 Turning Razorpay off hides "Pay via Razorpay" in Fees.

**Good habits**

- If you changed something, the "Save Changes" button must be pressed. Nothing is saved before that.
- If you switch tabs with unsaved changes, the page asks "Switch anyway and discard them?".
- The browser also warns you if you close the page with unsaved changes.

**Common mistakes**

- Leaving a tab without saving → your changes are lost. Press "Save Changes" first.
- Expecting "Change Password" here to work → it does not change your real password. Use the Admin page or Supabase Auth instead.
- Pressing "Test SMS" and expecting a message → the test does not send a real SMS yet.
- Clearing logs by mistake → clearing is permanent. Read the table name before you type it.

**Questions people ask**

- **Are the Active Sessions real?** No. The list is marked "(demo data)" on the page.
- **Do SMS and Email send messages now?** Not yet. The page says saving the details does not send anything. A server function is needed first.
- **Can I clear Students or Fees here?** No. Only Audit Logs, Fraud Events and Backup Logs can be cleared.
- **Are API keys safe here?** They are stored as plain text in the settings table. The page warns you about this. Show a key only when needed.

### 39. Link Staff

_Used by: Admin_

Connect each staff member to a login account, so they can sign in to the ERP. Only Admin can open this page.

**Before you start**

- The staff member must already exist in the Staff list.
- Only Admin can see this module. Other users see "Access Denied".

**Screens in this module**

| Screen | What it is for |
|---|---|
| ⚠️ Unlinked Staff | Staff who do not have a login yet. Each one has a drop-down to link a login. |
| ✅ Linked Staff | Staff who already have a login. Each one has an "Unlink" button. |

**How to…**

#### 39.1 Check who needs a login

1. Click "Link Staff" in the sidebar.
2. Look at the top numbers: Staff, Linked and Unlinked.
3. Find the staff member under "⚠️ Unlinked Staff".

> 💡 Press "🔄 Refresh" to reload the list. The page also updates by itself when staff change ("Live sync on").

#### 39.2 Create a new login

1. Press "➕ Create User".
2. Fill "Name *", "Email *" and "Password *". "Phone" is optional.
3. Press "✅ Create User".
4. The new login now appears in the drop-down list.

> 💡 Give a temporary password and ask the staff member to keep it safe.

#### 39.3 Link a staff member to a login

1. Find the staff member under "⚠️ Unlinked Staff".
2. Open the drop-down "— Select Auth User to Link —".
3. Choose the correct login (the email is shown).
4. You will see "✅ Linked!" and the person moves to "✅ Linked Staff".

#### 39.4 Create logins for all unlinked staff

1. Press "⚡ Create All (number)". The number is how many staff are unlinked.
2. Read the question that asks to confirm, then confirm.
3. Wait. The button shows "⏳ Creating…".
4. In "⚡ Bulk Results", copy each Email and Temp Password.

> 💡 If a staff member has no email, an email like name+id@gnsi.edu is made for them.

#### 39.5 Unlink a staff member

1. Find the person under "✅ Linked Staff".
2. Press "Unlink".
3. Confirm "Unlink this staff member?".

**Good habits**

- Link the staff member to the right login. Check the name and email before choosing.
- A green "UPDATED" tag shows on a row that just changed.

**Common mistakes**

- Closing the Bulk Results without copying passwords → the passwords are shown only once. Copy them first.
- Linking a staff member to someone else's login → check the email in the drop-down carefully.
- Pressing "⚡ Create All" without checking → it creates logins for every unlinked staff member.

**Questions people ask**

- **Why does a staff member not appear in the drop-down?** The login must exist first. Press "➕ Create User", or press "🔄 Refresh".
- **What happens if I unlink someone?** The staff record stays, but it is no longer connected to that login. You can link again later.
- **Where do I see the passwords after Create All?** Only in "⚡ Bulk Results" right after it finishes. They are not shown again.

### Help

### 40. Help & Training

_Used by: Any staff_

Step-by-step guides for every module, a list of what has changed, recommended training paths by job, and a tracker of what you have already learned.

**Screens in this module**

| Screen | What it is for |
|---|---|
| ✨ What's new | Everything that changed, newest first. Filter by New, Improved, Fixed or Security. "Learn how →" opens the guide. |
| 📚 Module guides | Search and read the guide for any module you can open. |
| 🎯 Training paths | A recommended order of guides for your job (accountant, reception, teacher, housemaster, administrator). |

**How to…**

#### 40.1 Learn a module

1. Open Help & Training from the sidebar (or press the "📖 Help" button at the top of any page).
2. Choose "📚 Module guides" and pick the module on the left, or type a word in the search box.
3. Read "Before you start", then open each "Step by step" item.
4. When you are confident, tick "Mark as learned". Your progress bar at the top moves.

#### 40.2 Follow a training path

1. Open "🎯 Training paths" and pick the path that matches your job.
2. Work through the guides in the order shown. Ticks appear as you mark them learned.

#### 40.3 Print a guide

1. Open the guide and press "🖨 Print guide". Allow pop-ups if your browser asks.

**Good habits**

- Your "learned" ticks are saved in this browser only, so they stay on this computer/phone.
- Use "Only modules I can open" to hide guides for modules you do not have access to.

**Common mistakes**

- Looking for a guide for a module you cannot open → untick "Only modules I can open" to read it anyway.

**Questions people ask**

- **Who updates these guides?** They are written from the real screens. When a feature changes, the guide and the "What's new" list are updated together.
- **Is my progress shared with the admin?** No. It is stored only in your own browser.

## Appendix A — When something goes wrong

| What you see | What to do |
|---|---|
| "Secure database connection is off" or records show empty / ₹0 | Press "Sign in again". If it continues, tell the admin. |
| "Only an admin can…" or "violates row-level security" | You do not have permission for that action. Ask an admin to do it. |
| "…is closed in Accounts" | The month is locked. Ask an admin to post or correct the entry. |
| A fee amount looks old or wrong | Check Fee Setup for a red NOT CONFIGURED tag for that course/batch/hostel type. |
| A student shows dues you did not expect | Check the student's course, hostel type and admission date (Fees → Data Health), then the Student Ledger for that month. |
| A scholarship is not reducing the dues | It must be Active in Fees → Register and cover that month and fee type. |
| Printing or Save-as-PDF opens nothing | Allow pop-ups for the portal in your browser. |
| You were logged out | Sessions end after 24 hours, or after the inactivity time the admin set. Sign in again. |
| A button or module is missing | Your role does not include it. Ask the admin to review your permissions. |
| A photo is too large | Photos are compressed automatically on upload; try again with a normal phone photo. |

## Appendix B — New staff first-week checklist

1. Sign in and change nothing until you know your modules (look at the sidebar).
2. Read "Part 1" and "Part 2" of this guide.
3. Open Help & Training → Training paths and follow the path for your job.
4. Read the guide for each module you use and tick "Mark as learned".
5. Do a practice task with a senior colleague watching (for fees: collect a small test fee and revert it with the admin).
6. Ask the admin to confirm your permissions are right.

