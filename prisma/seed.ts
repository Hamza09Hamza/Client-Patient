import { PrismaClient, ValueFlag, ResultStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

interface AnalyteSpec {
  analyte: string;
  unit: string;
  low: number;
  high: number;
  decimals: number;
}

interface PanelSpec {
  category: string;
  testName: string;
  specimen: string;
  analytes: AnalyteSpec[];
}

const PANELS: PanelSpec[] = [
  {
    category: "Hematology",
    testName: "Complete Blood Count (CBC)",
    specimen: "Whole blood (EDTA)",
    analytes: [
      { analyte: "White Blood Cells", unit: "10³/µL", low: 4.0, high: 11.0, decimals: 1 },
      { analyte: "Red Blood Cells", unit: "10⁶/µL", low: 4.5, high: 5.9, decimals: 2 },
      { analyte: "Hemoglobin", unit: "g/dL", low: 13.0, high: 17.0, decimals: 1 },
      { analyte: "Hematocrit", unit: "%", low: 40, high: 52, decimals: 1 },
      { analyte: "Platelets", unit: "10³/µL", low: 150, high: 400, decimals: 0 },
    ],
  },
  {
    category: "Biochemistry",
    testName: "Basic Metabolic Panel",
    specimen: "Serum",
    analytes: [
      { analyte: "Glucose (fasting)", unit: "mg/dL", low: 70, high: 99, decimals: 0 },
      { analyte: "Creatinine", unit: "mg/dL", low: 0.7, high: 1.3, decimals: 2 },
      { analyte: "Urea", unit: "mg/dL", low: 17, high: 43, decimals: 0 },
      { analyte: "Sodium", unit: "mmol/L", low: 135, high: 145, decimals: 0 },
      { analyte: "Potassium", unit: "mmol/L", low: 3.5, high: 5.1, decimals: 1 },
      { analyte: "Chloride", unit: "mmol/L", low: 98, high: 107, decimals: 0 },
    ],
  },
  {
    category: "Biochemistry",
    testName: "Lipid Profile",
    specimen: "Serum",
    analytes: [
      { analyte: "Total Cholesterol", unit: "mg/dL", low: 120, high: 200, decimals: 0 },
      { analyte: "HDL Cholesterol", unit: "mg/dL", low: 40, high: 90, decimals: 0 },
      { analyte: "LDL Cholesterol", unit: "mg/dL", low: 50, high: 130, decimals: 0 },
      { analyte: "Triglycerides", unit: "mg/dL", low: 50, high: 150, decimals: 0 },
    ],
  },
  {
    category: "Endocrinology",
    testName: "Thyroid Function (TSH, FT4)",
    specimen: "Serum",
    analytes: [
      { analyte: "TSH", unit: "mIU/L", low: 0.4, high: 4.0, decimals: 2 },
      { analyte: "Free T4", unit: "ng/dL", low: 0.8, high: 1.8, decimals: 2 },
    ],
  },
  {
    category: "Biochemistry",
    testName: "Liver Function Panel",
    specimen: "Serum",
    analytes: [
      { analyte: "ALT (SGPT)", unit: "U/L", low: 7, high: 56, decimals: 0 },
      { analyte: "AST (SGOT)", unit: "U/L", low: 10, high: 40, decimals: 0 },
      { analyte: "Alkaline Phosphatase", unit: "U/L", low: 44, high: 147, decimals: 0 },
      { analyte: "Total Bilirubin", unit: "mg/dL", low: 0.1, high: 1.2, decimals: 2 },
    ],
  },
  {
    category: "Endocrinology",
    testName: "HbA1c (Glycated Hemoglobin)",
    specimen: "Whole blood (EDTA)",
    analytes: [{ analyte: "HbA1c", unit: "%", low: 4.0, high: 5.7, decimals: 1 }],
  },
  {
    category: "Immunology",
    testName: "C-Reactive Protein (CRP)",
    specimen: "Serum",
    analytes: [{ analyte: "CRP", unit: "mg/L", low: 0, high: 5, decimals: 1 }],
  },
  {
    category: "Immunology",
    testName: "Vitamin D (25-OH)",
    specimen: "Serum",
    analytes: [{ analyte: "25-OH Vitamin D", unit: "ng/mL", low: 30, high: 100, decimals: 0 }],
  },
];

const PHYSICIANS = ["Dr. L. Mansouri", "Dr. S. Haddad", "Dr. A. Benali", "Dr. R. Cherif"];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function buildValues(panel: PanelSpec, abnormalChance: number) {
  return panel.analytes.map((a, i) => {
    const span = a.high - a.low;
    let value: number;
    let flag: ValueFlag = ValueFlag.NORMAL;
    const roll = Math.random();
    if (roll < abnormalChance / 2) {
      value = a.high + rand(0.02, 0.35) * span;
      flag = value > a.high + 0.6 * span ? ValueFlag.CRITICAL : ValueFlag.HIGH;
    } else if (roll < abnormalChance) {
      value = Math.max(0, a.low - rand(0.02, 0.3) * span);
      flag = ValueFlag.LOW;
    } else {
      value = rand(a.low + 0.08 * span, a.high - 0.08 * span);
    }
    return {
      analyte: a.analyte,
      value: value.toFixed(a.decimals),
      unit: a.unit,
      refRange: `${a.low.toFixed(a.decimals)} – ${a.high.toFixed(a.decimals)}`,
      flag,
      sortOrder: i,
    };
  });
}

async function main() {
  console.log("Seeding clinic_portal ...");

  await db.auditLog.deleteMany();
  await db.passwordResetRequest.deleteMany();
  await db.labResultValue.deleteMany();
  await db.labResult.deleteMany();
  await db.patient.deleteMany();
  await db.admin.deleteMany();

  const hash = (pw: string) => bcrypt.hash(pw, 12);

  await db.admin.create({
    data: {
      username: "admin",
      fullName: "Clinic Administrator",
      passwordHash: await hash("ClinicAdmin!2026"),
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
        passwordHash: await hash(spec.password),
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

      await db.labResult.create({
        data: {
          reference: `LAB-${new Date(collectedAt).getFullYear()}-${accession++}`,
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
          values: status === ResultStatus.PENDING ? undefined : { create: buildValues(panel, 0.18) },
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
    values: await db.labResultValue.count(),
  };
  console.log(`Seeded: ${counts.patients} patients, ${counts.results} results, ${counts.values} values`);
  console.log("Demo logins — patient: PAT-2026-0001 / Demo-Pass-2026 — admin: admin / ClinicAdmin!2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
