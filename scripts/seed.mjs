#!/usr/bin/env node
/**
 * Seeds a realistic school for inspecting the UI.
 *
 * Uses the service-role key, which bypasses Row Level Security. That is correct
 * here (this is provisioning, not a user request) and is exactly why this script
 * must never be reachable from the app.
 *
 *   node scripts/seed.mjs          seed
 *   node scripts/seed.mjs --reset  delete seeded data first, then seed
 *
 * Reads .env.local. Safe to re-run: --reset clears anything it created before.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* -------------------------------------------------------------------------- */

function loadEnv() {
  try {
    for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the shell instead */
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase renamed service_role to the "secret key" (sb_secret_...) and anon to
// the "publishable key". Both namings accepted so legacy and current projects
// work unchanged.
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !SERVICE_KEY || !PUBLISHABLE_KEY || URL.includes("placeholder")) {
  console.error(
    "\nMissing real Supabase credentials.\n\n" +
      "  NEXT_PUBLIC_SUPABASE_URL   your project URL\n" +
      "  SUPABASE_SECRET_KEY        sb_secret_... (was: service_role)\n\n" +
      "The secret key is NOT shown on the project home page. Find it under\n" +
      "Project Settings -> API Keys -> Secret keys. Reveal or create one there.\n\n" +
      "It bypasses Row Level Security, so keep it out of NEXT_PUBLIC_* and out\n" +
      "of anything committed.\n",
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes("--reset");
const PASSWORD = "GracePortal2026";

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

const ACCOUNTS = [
  {
    email: "head@thegraceschools.test",
    role: "admin",
    full_name: "Mr. Harrison Ouso",
    can_release_results: true,
    note: "Headteacher. Holds the results release permission.",
  },
  {
    email: "admin@thegraceschools.test",
    role: "admin",
    full_name: "Madam Jecinta Ogolo",
    can_release_results: false,
    note: "Administrator. Cannot publish results.",
  },
  {
    email: "teacher.g7@thegraceschools.test",
    role: "teacher",
    full_name: "Mr. Brian Ogwang",
    can_release_results: false,
    note: "Class teacher, Grade 7. Sees Grade 7 only.",
  },
  {
    email: "teacher.g2@thegraceschools.test",
    role: "teacher",
    full_name: "Madam Anne Chepkoech",
    can_release_results: false,
    note: "Class teacher, Grade 2 and PP1. Observation-based marking.",
  },
  {
    email: "parent.achieng@thegraceschools.test",
    role: "parent",
    full_name: "Mrs. Grace Achieng",
    can_release_results: false,
    note: "Two children. Grade 7 results RELEASED, Grade 2 results DRAFT.",
  },
  {
    email: "parent.kiprono@thegraceschools.test",
    role: "parent",
    full_name: "Mr. Samuel Kiprono",
    can_release_results: false,
    note: "One child in Grade 7. Results still DRAFT, so no marks visible.",
  },
];

const STUDENTS = [
  { adm: "GS/2026/001", first: "Faith",   last: "Achieng",  grade: "G7", guardian: "parent.achieng@thegraceschools.test" },
  { adm: "GS/2026/002", first: "Brian",   last: "Achieng",  grade: "G2", guardian: "parent.achieng@thegraceschools.test" },
  { adm: "GS/2026/003", first: "Mercy",   last: "Kiprono",  grade: "G7", guardian: "parent.kiprono@thegraceschools.test" },
  { adm: "GS/2026/004", first: "Kevin",   last: "Otieno",   grade: "G7", guardian: null },
  { adm: "GS/2026/005", first: "Sharon",  last: "Wanjiru",  grade: "G7", guardian: null },
  { adm: "GS/2026/006", first: "Dennis",  last: "Kimutai",  grade: "G7", guardian: null },
  { adm: "GS/2026/007", first: "Cynthia", last: "Nyaboke",  grade: "G2", guardian: null },
  { adm: "GS/2026/008", first: "Emmanuel",last: "Kiplagat", grade: "G2", guardian: null },
  { adm: "GS/2026/009", first: "Joy",     last: "Adhiambo", grade: "PP1", guardian: null },
];

// Grade 7 CBE learning areas, abbreviated to a workable set.
const SUBJECTS = [
  { code: "ENG",  name: "English",              sort: 1 },
  { code: "KIS",  name: "Kiswahili",            sort: 2 },
  { code: "MATH", name: "Mathematics",          sort: 3 },
  { code: "SCI",  name: "Integrated Science",   sort: 4 },
  { code: "SST",  name: "Social Studies",       sort: 5 },
  { code: "AGN",  name: "Agriculture and Nutrition", sort: 6 },
];

/* Marks chosen to land on interesting CBE bands, including a not-assessed. */
const G7_MARKS = {
  "GS/2026/001": { ENG: 88, KIS: 74, MATH: 92, SCI: 61, SST: 79, AGN: 45 },
  "GS/2026/003": { ENG: 55, KIS: 48, MATH: 38, SCI: 62, SST: 51, AGN: 70 },
  "GS/2026/004": { ENG: 29, KIS: 33, MATH: 18, SCI: 41, SST: 25, AGN: 36 },
  "GS/2026/005": { ENG: 95, KIS: 91, MATH: 97, SCI: 89, SST: 93, AGN: 90 },
  // Deliberately missing MATH: renders "Not assessed", not the bottom grade.
  "GS/2026/006": { ENG: 66, KIS: 58, MATH: null, SCI: 72, SST: 64, AGN: 0 },
};

/* -------------------------------------------------------------------------- */

const log = (...a) => console.log(...a);
function die(label, error) {
  if (error) {
    console.error(`\nFAILED at: ${label}\n`, error.message ?? error, "\n");
    process.exit(1);
  }
}

async function reset() {
  log("Resetting seeded data...");

  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? []) {
    if (u.email?.endsWith("@thegraceschools.test")) {
      await db.auth.admin.deleteUser(u.id);
    }
  }
  // Everything else cascades from the academic year and the student rows.
  await db.from("students").delete().like("admission_no", "GS/2026/%");
  await db.from("academic_years").delete().eq("name", "2026");
  await db.from("subjects").delete().in("code", SUBJECTS.map((s) => s.code));
  log("  cleared\n");
}

async function main() {
  log(`\nSeeding ${URL}\n`);
  if (RESET) await reset();

  /* --- accounts ---------------------------------------------------------- */
  log("Creating accounts...");
  const userIds = {};
  for (const acct of ACCOUNTS) {
    const { data, error } = await db.auth.admin.createUser({
      email: acct.email,
      password: PASSWORD,
      email_confirm: true,
    });

    if (error && !/already been registered|already exists/i.test(error.message)) {
      die(`create user ${acct.email}`, error);
    }

    let id = data?.user?.id;
    if (!id) {
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      id = list?.users?.find((u) => u.email === acct.email)?.id;
    }
    if (!id) die(`resolve user id for ${acct.email}`, new Error("not found"));
    userIds[acct.email] = id;

    const { error: pErr } = await db.from("profiles").upsert({
      id,
      role: acct.role,
      full_name: acct.full_name,
      email: acct.email,
      can_release_results: acct.can_release_results,
      // false so you land straight in the portal rather than the change-password screen
      must_change_password: false,
      is_active: true,
    });
    die(`profile for ${acct.email}`, pErr);
    log(`  ${acct.full_name} (${acct.role})`);
  }

  /* --- calendar ---------------------------------------------------------- */
  log("\nCreating academic year and terms...");
  const { data: year, error: yErr } = await db
    .from("academic_years")
    .upsert({ name: "2026", starts_on: "2026-01-05", ends_on: "2026-11-27", is_current: true },
            { onConflict: "name" })
    .select().single();
  die("academic year", yErr);

  const termRows = [
    { academic_year_id: year.id, name: "Term 1", term_number: 1, starts_on: "2026-01-05", ends_on: "2026-04-10", is_current: false },
    { academic_year_id: year.id, name: "Term 2", term_number: 2, starts_on: "2026-05-04", ends_on: "2026-08-07", is_current: true },
    { academic_year_id: year.id, name: "Term 3", term_number: 3, starts_on: "2026-09-01", ends_on: "2026-11-27", is_current: false },
  ];
  const { data: terms, error: tErr } = await db
    .from("terms").upsert(termRows, { onConflict: "academic_year_id,term_number" }).select();
  die("terms", tErr);
  const term2 = terms.find((t) => t.term_number === 2);

  /* --- subjects ---------------------------------------------------------- */
  const { data: subjects, error: sErr } = await db
    .from("subjects")
    .upsert(SUBJECTS.map((s) => ({ code: s.code, name: s.name, sort_order: s.sort })),
            { onConflict: "code" })
    .select();
  die("subjects", sErr);
  const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s]));

  const { error: sglErr } = await db.from("subject_grade_levels").upsert(
    subjects.flatMap((s) => ["G7"].map((g) => ({ subject_id: s.id, grade_code: g }))),
    { onConflict: "subject_id,grade_code" },
  );
  die("subject grade levels", sglErr);

  /* --- classes ----------------------------------------------------------- */
  log("Creating classes...");
  const classRows = [
    { academic_year_id: year.id, grade_code: "PP1", stream: null, class_teacher_id: userIds["teacher.g2@thegraceschools.test"] },
    { academic_year_id: year.id, grade_code: "G2",  stream: null, class_teacher_id: userIds["teacher.g2@thegraceschools.test"] },
    { academic_year_id: year.id, grade_code: "G7",  stream: null, class_teacher_id: userIds["teacher.g7@thegraceschools.test"] },
  ];
  const { data: classes, error: cErr } = await db
    .from("classes").upsert(classRows, { onConflict: "academic_year_id,grade_code,stream" }).select();
  die("classes", cErr);
  const classByGrade = Object.fromEntries(classes.map((c) => [c.grade_code, c]));

  const { error: scaErr } = await db.from("staff_class_assignments").upsert(
    subjects.map((s) => ({
      staff_id: userIds["teacher.g7@thegraceschools.test"],
      class_id: classByGrade.G7.id,
      subject_id: s.id,
    })),
    { onConflict: "staff_id,class_id,subject_id" },
  );
  die("staff class assignments", scaErr);

  /* --- learners ---------------------------------------------------------- */
  log("Enrolling learners...");
  const { data: students, error: stErr } = await db
    .from("students")
    .upsert(STUDENTS.map((s) => ({
      admission_no: s.adm, first_name: s.first, last_name: s.last, is_active: true,
    })), { onConflict: "admission_no" })
    .select();
  die("students", stErr);
  const studentByAdm = Object.fromEntries(students.map((s) => [s.admission_no, s]));

  const { error: enErr } = await db.from("enrollments").upsert(
    STUDENTS.map((s) => ({
      student_id: studentByAdm[s.adm].id,
      class_id: classByGrade[s.grade].id,
      academic_year_id: year.id,
    })),
    { onConflict: "student_id,academic_year_id" },
  );
  die("enrollments", enErr);

  const { error: gsErr } = await db.from("guardian_students").upsert(
    STUDENTS.filter((s) => s.guardian).map((s) => ({
      guardian_id: userIds[s.guardian],
      student_id: studentByAdm[s.adm].id,
      relationship: "guardian",
      is_primary: true,
    })),
    { onConflict: "guardian_id,student_id" },
  );
  die("guardian links", gsErr);

  /* --- assessments and marks --------------------------------------------- */
  log("Entering marks...");
  const { data: assessments, error: aErr } = await db
    .from("assessments")
    .upsert(subjects.map((s) => ({
      class_id: classByGrade.G7.id,
      subject_id: s.id,
      term_id: term2.id,
      name: `End of Term 2 ${s.name}`,
      type: "endterm",
      max_score: 100,
      created_by: userIds["teacher.g7@thegraceschools.test"],
    })))
    .select();
  die("assessments", aErr);
  const assessmentBySubject = Object.fromEntries(
    assessments.map((a) => [
      Object.keys(subjectByCode).find((c) => subjectByCode[c].id === a.subject_id),
      a,
    ]),
  );

  const scoreRows = [];
  for (const [adm, marks] of Object.entries(G7_MARKS)) {
    for (const [code, mark] of Object.entries(marks)) {
      scoreRows.push({
        assessment_id: assessmentBySubject[code].id,
        student_id: studentByAdm[adm].id,
        raw_score: mark,
        entered_by: userIds["teacher.g7@thegraceschools.test"],
      });
    }
  }
  const { error: scErr } = await db
    .from("scores").upsert(scoreRows, { onConflict: "assessment_id,student_id" });
  die("scores", scErr);

  /* --- report cards: one released, one draft ----------------------------- */
  log("Creating report cards...");
  const g7Students = STUDENTS.filter((s) => s.grade === "G7");
  const { data: cards, error: rcErr } = await db.from("report_cards").upsert(
    g7Students.map((s) => ({
      student_id: studentByAdm[s.adm].id,
      term_id: term2.id,
      class_id: classByGrade.G7.id,
      status: "draft",
      class_teacher_remark:
        "Settling well this term and contributing in class discussions.",
    })),
    { onConflict: "student_id,term_id" },
  ).select();
  die("report cards", rcErr);

  // Release only Faith Achieng's, so the release gate is visible: her mother
  // sees marks, Mercy Kiprono's father sees none.
  //
  // Done through a real signed-in headteacher session rather than the secret
  // key. The release trigger requires an identified actor holding the
  // permission, and the service role does not bypass triggers, only RLS. Going
  // through the front door here also proves the gate works end to end.
  const faithCard = cards.find((c) => c.student_id === studentByAdm["GS/2026/001"].id);

  const asHead = createClient(URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await asHead.auth.signInWithPassword({
    email: "head@thegraceschools.test",
    password: PASSWORD,
  });
  die("sign in as headteacher", signInErr);

  const { error: relErr } = await asHead
    .from("report_cards")
    .update({
      status: "released",
      head_remark: "A pleasing set of results. Keep up the effort next term.",
    })
    .eq("id", faithCard.id);
  die("release report card", relErr);
  await asHead.auth.signOut();

  /* --- attendance and fees ----------------------------------------------- */
  log("Marking attendance and fee balances...");
  const today = new Date().toISOString().slice(0, 10);
  const { data: session, error: asErr } = await db
    .from("attendance_sessions")
    .upsert({ class_id: classByGrade.G7.id, session_date: today,
              taken_by: userIds["teacher.g7@thegraceschools.test"] },
            { onConflict: "class_id,session_date" })
    .select().single();
  die("attendance session", asErr);

  const { error: arErr } = await db.from("attendance_records").upsert(
    g7Students.map((s, i) => ({
      session_id: session.id,
      student_id: studentByAdm[s.adm].id,
      status: i === 1 ? "absent" : i === 2 ? "late" : "present",
      reason: i === 1 ? "sick" : null,
    })),
    { onConflict: "session_id,student_id" },
  );
  die("attendance records", arErr);

  const { error: fbErr } = await db.from("fee_balances").upsert(
    STUDENTS.map((s, i) => ({
      student_id: studentByAdm[s.adm].id,
      balance_kes: [0, 4500, 12000, 2500][i % 4],
      as_of: today,
      uploaded_by: userIds["admin@thegraceschools.test"],
    })),
    { onConflict: "student_id,as_of" },
  );
  die("fee balances", fbErr);

  /* --- notice ------------------------------------------------------------ */
  // notices has no natural unique key, so check before inserting rather than
  // stacking a duplicate every time the script is re-run without --reset.
  const NOTICE_TITLE = "Term 2 closing date";
  const { data: existingNotice } = await db
    .from("notices").select("id").eq("title", NOTICE_TITLE).maybeSingle();

  if (!existingNotice) {
    const { error: nErr } = await db.from("notices").insert({
      title: NOTICE_TITLE,
      body: "Term 2 closes on Friday 7 August. Buses leave the school at 10:00am.",
      audience: "all_parents",
      published_at: new Date().toISOString(),
      created_by: userIds["admin@thegraceschools.test"],
    });
    die("notice", nErr);
  }

  /* --- summary ----------------------------------------------------------- */
  log("\n" + "=".repeat(74));
  log("SEED COMPLETE. All accounts use the password:  " + PASSWORD);
  log("=".repeat(74));
  for (const a of ACCOUNTS) {
    log(`\n  ${a.email}`);
    log(`    ${a.full_name} (${a.role})`);
    log(`    ${a.note}`);
  }
  log("\n" + "-".repeat(74));
  log("Worth looking at:");
  log("  - Sign in as Mrs. Achieng: results are RELEASED, so marks show.");
  log("  - Sign in as Mr. Kiprono: results are DRAFT, so no marks at all.");
  log("    Same page, same code path. The database is what refuses.");
  log("  - Dennis Kimutai has no Maths mark: renders 'Not assessed', not BE.");
  log("    He also scored 0 in Agriculture, which correctly renders BE2.");
  log("  - Sign in as Madam Ogolo (admin, no release permission) and as");
  log("    Mr. Ouso (headteacher, has it) to compare the admin overview.");
  log("\nTo see the forced password change screen:");
  log("  update profiles set must_change_password = true where email = '...';");
  log("-".repeat(74) + "\n");
}

main().catch((e) => die("unexpected", e));
