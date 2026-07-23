import { PrismaClient, ResultStatus } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

interface PanelSpec {
  category: string;
  testName: string;
  specimen: string;
}

// Reports are PDFs synced from the clinic's own system (see document-sync.ts) —
// these panel names are just realistic labels for demo report titles, not
// structured analyte data (there is none: the portal only shows the PDF).
const PANELS: PanelSpec[] = [
  { category: "Hematology", testName: "Complete Blood Count (CBC)", specimen: "Whole blood (EDTA)" },
  { category: "Biochemistry", testName: "Basic Metabolic Panel", specimen: "Serum" },
  { category: "Biochemistry", testName: "Lipid Profile", specimen: "Serum" },
  { category: "Endocrinology", testName: "Thyroid Function (TSH, FT4)", specimen: "Serum" },
  { category: "Biochemistry", testName: "Liver Function Panel", specimen: "Serum" },
  { category: "Endocrinology", testName: "HbA1c (Glycated Hemoglobin)", specimen: "Whole blood (EDTA)" },
  { category: "Immunology", testName: "C-Reactive Protein (CRP)", specimen: "Serum" },
  { category: "Immunology", testName: "Vitamin D (25-OH)", specimen: "Serum" },
];

const PHYSICIANS = ["Dr. L. Mansouri", "Dr. S. Haddad", "Dr. A. Benali", "Dr. R. Cherif"];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function main() {
  // This script wipes every table before reseeding — never let it touch a
  // real clinic database by accident.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    console.error(
      "Refusing to seed: NODE_ENV=production. This script deletes all existing data.\n" +
        "If you really mean to do this (e.g. a fresh staging environment), set ALLOW_PROD_SEED=true.",
    );
    process.exit(1);
  }

  console.log("Seeding clinic_portal ...");

  await db.auditLog.deleteMany();
  await db.passwordResetRequest.deleteMany();
  await db.labResult.deleteMany();
  await db.patient.deleteMany();
  await db.admin.deleteMany();

  await db.admin.create({
    data: {
      username: "admin",
      fullName: "Clinic Administrator",
      password: "ClinicAdmin!2026",
    },
  });

  const patientsSpec = [
    { patientId: "PAT-2026-0001", fullName: "Yacine Benhamed", email: "yacine.benhamed@example.com", phone: "+213 550 12 34 56", dateOfBirth: new Date("1988-04-12"), gender: "Male", password: "Demo-Pass-2026", results: 26 },
    { patientId: "PAT-2026-0002", fullName: "Amira Kaci", email: "amira.kaci@example.com", phone: "+213 661 98 76 54", dateOfBirth: new Date("1993-11-03"), gender: "Female", password: "Amira-Kc26-Test", results: 12 },
    { patientId: "PAT-2026-0003", fullName: "Mohamed Larbi", email: "m.larbi@example.com", phone: "+213 770 45 67 89", dateOfBirth: new Date("1961-02-27"), gender: "Male", password: "Moha-Lb26-Test", results: 18 },
    { patientId: "PAT-2026-0004", fullName: "Selma Bouzid", email: "selma.bouzid@example.com", phone: null, dateOfBirth: new Date("2001-07-19"), gender: "Female", password: "Selma-Bz26-Test", results: 6 },
    { patientId: "PAT-2026-0005", fullName: "Karim Ziani", email: null, phone: "+213 555 22 11 00", dateOfBirth: new Date("1975-09-30"), gender: "Male", password: "Karim-Zn26-Test", results: 9 },
  ];

  let accession = 1000;
  const now = Date.now();

  for (const spec of patientsSpec) {
    const patient = await db.patient.create({
      data: {
        patientId: spec.patientId,
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        dateOfBirth: spec.dateOfBirth,
        gender: spec.gender,
        password: spec.password,
        lastLoginAt: new Date(now - rand(1, 20) * 86_400_000),
      },
    });

    for (let i = 0; i < spec.results; i++) {
      const panel = PANELS[Math.floor(Math.random() * PANELS.length)];
      const daysAgo = rand(0, 300);
      const collectedAt = new Date(now - daysAgo * 86_400_000);
      const isRecent = daysAgo < 2;
      const status: ResultStatus = isRecent
        ? ResultStatus.PENDING
        : Math.random() < 0.75
          ? ResultStatus.REVIEWED
          : ResultStatus.COMPLETED;
      const reportedAt =
        status === ResultStatus.PENDING ? null : new Date(collectedAt.getTime() + rand(6, 48) * 3_600_000);
      const reference = `LAB-${new Date(collectedAt).getFullYear()}-${accession++}`;

      await db.labResult.create({
        data: {
          reference,
          patientDbId: patient.id,
          category: panel.category,
          testName: panel.testName,
          specimen: panel.specimen,
          status,
          orderingPhysician: PHYSICIANS[Math.floor(Math.random() * PHYSICIANS.length)],
          collectedAt,
          reportedAt,
          notes:
            Math.random() < 0.2
              ? "Sample slightly hemolyzed; values verified by repeat analysis."
              : null,
          // Demo reports all point at the same sample PDF so the viewer has
          // something real to render — a genuine sync fills in real per-report links.
          sourceRef: status === ResultStatus.PENDING ? null : `SRC-${reference}`,
          sourceLink: status === ResultStatus.PENDING ? null : "/sample-reports/sample-report.pdf",
        },
      });
    }
  }

  // A pending forgot-password request with a placeholder ID photo
  const uploadsDir = join(process.cwd(), "uploads");
  mkdirSync(uploadsDir, { recursive: true });
  const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" fill="#e8f1f6"/><rect x="24" y="24" width="140" height="180" rx="8" fill="#cbd5e1"/><rect x="190" y="40" width="240" height="18" rx="4" fill="#94a3b8"/><rect x="190" y="76" width="200" height="14" rx="4" fill="#b6c2d0"/><rect x="190" y="104" width="220" height="14" rx="4" fill="#b6c2d0"/><text x="240" y="270" font-family="sans-serif" font-size="16" fill="#64748b">Seed placeholder ID document</text></svg>`;
  writeFileSync(join(uploadsDir, "seed-id-photo.svg"), placeholder);

  const amira = await db.patient.findUniqueOrThrow({ where: { patientId: "PAT-2026-0002" } });
  await db.passwordResetRequest.create({
    data: {
      submittedPatientId: "PAT-2026-0002",
      patientDbId: amira.id,
      email: "amira.kaci@example.com",
      note: "I changed phones and lost the note where my password was saved. Please reset it so I can check my thyroid results.",
      idPhotoPath: "seed-id-photo.svg",
    },
  });

  await db.auditLog.createMany({
    data: [
      { actorType: "SYSTEM", actorId: "seed", action: "DATABASE_SEEDED", detail: "Initial demo dataset created" },
      { actorType: "ADMIN", actorId: "admin", action: "PATIENT_CREATED", target: "PAT-2026-0001" },
      { actorType: "PATIENT", actorId: "PAT-2026-0001", action: "LOGIN" },
    ],
  });

  const counts = {
    patients: await db.patient.count(),
    results: await db.labResult.count(),
  };
  console.log(`Seeded: ${counts.patients} patients, ${counts.results} results`);
  console.log("Demo logins — patient: PAT-2026-0001 / Demo-Pass-2026 — admin: admin / ClinicAdmin!2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
