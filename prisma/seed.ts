import { PrismaClient, ResultStatus } from "@prisma/client";
import { copyFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createShareGrant } from "../src/lib/report-share";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

interface PanelSpec {
  category: string;
  testName: string;
  specimen: string;
}

// Reports are PDFs pushed from the clinic's own system (see
// src/app/api/integration/reports/route.ts) — these panel names are just
// realistic labels for demo report titles, not structured analyte data
// (there is none: the portal only shows the PDF).
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

  // Reports are served from uploads/reports/ (see src/lib/report-storage.ts) —
  // seed a copy of the sample PDF there so demo reports render for real
  // through the same local-storage path a genuine push from the clinic's
  // system would use, rather than pointing at a public/ static file.
  const reportsDir = join(process.cwd(), "uploads", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const seedPdfName = "seed-sample-report.pdf";
  copyFileSync(
    join(process.cwd(), "public", "sample-reports", "sample-report.pdf"),
    join(reportsDir, seedPdfName),
  );

  await db.auditLog.deleteMany();
  await db.reportShareGrant.deleteMany();
  await db.labResult.deleteMany();
  await db.patient.deleteMany();

  const patientsSpec = [
    { patientId: "PAT-2026-0001", fullName: "Yacine Benhamed", email: "yacine.benhamed@example.com", phone: "+213 550 12 34 56", dateOfBirth: new Date("1988-04-12"), gender: "Male", password: "Demo-Pass-2026", results: 26 },
    { patientId: "PAT-2026-0002", fullName: "Amira Kaci", email: "amira.kaci@example.com", phone: "+213 661 98 76 54", dateOfBirth: new Date("1993-11-03"), gender: "Female", password: "Amira-Kc26-Test", results: 12 },
    { patientId: "PAT-2026-0003", fullName: "Mohamed Larbi", email: "m.larbi@example.com", phone: "+213 770 45 67 89", dateOfBirth: new Date("1961-02-27"), gender: "Male", password: "Moha-Lb26-Test", results: 18 },
    { patientId: "PAT-2026-0004", fullName: "Selma Bouzid", email: "selma.bouzid@example.com", phone: null, dateOfBirth: new Date("2001-07-19"), gender: "Female", password: "Selma-Bz26-Test", results: 6 },
    { patientId: "PAT-2026-0005", fullName: "Karim Ziani", email: null, phone: "+213 555 22 11 00", dateOfBirth: new Date("1975-09-30"), gender: "Male", password: "Karim-Zn26-Test", results: 9 },
  ];

  let accession = 1000;
  const now = Date.now();
  let demoShareResultId: string | null = null;

  for (const spec of patientsSpec) {
    const patient = await db.patient.create({
      data: {
        patientId: spec.patientId,
        fullName: spec.fullName,
        email: spec.email,
        phone: spec.phone,
        dateOfBirth: spec.dateOfBirth,
        gender: spec.gender,
        passwordHash: await hashPassword(spec.password),
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

      const created = await db.labResult.create({
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
          // Demo reports all point at the same locally stored sample PDF so
          // the viewer has something real to render — a genuine push from
          // the clinic's system stores a distinct file per report.
          sourceRef: status === ResultStatus.PENDING ? null : `SRC-${reference}`,
          pdfPath: status === ResultStatus.PENDING ? null : seedPdfName,
        },
      });

      if (!demoShareResultId && created.pdfPath) demoShareResultId = created.id;
    }
  }

  await db.auditLog.createMany({
    data: [
      { actorType: "SYSTEM", actorId: "seed", action: "DATABASE_SEEDED", detail: "Initial demo dataset created" },
      { actorType: "SYSTEM", actorId: "integration", action: "PATIENT_CREATED", target: "PAT-2026-0001" },
      { actorType: "PATIENT", actorId: "PAT-2026-0001", action: "LOGIN" },
    ],
  });

  const counts = {
    patients: await db.patient.count(),
    results: await db.labResult.count(),
  };
  console.log(`Seeded: ${counts.patients} patients, ${counts.results} results`);
  console.log("Demo login — patient: PAT-2026-0001 / Demo-Pass-2026");

  if (demoShareResultId) {
    const origin = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    const grant = await createShareGrant(demoShareResultId);
    console.log(`Demo QR share link (visit directly, no login needed): ${origin}/r/${grant.publicId}#t=${grant.token}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
