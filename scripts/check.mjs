import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const acquisition = process.argv.includes("--acquisition");
const pricing = process.argv.includes("--pricing");
const terminal = process.argv.includes("--terminal");
const payables = process.argv.includes("--payables");
const journeys = process.argv.includes("--journeys");
const medical = process.argv.includes("--medical");
const purchases = process.argv.includes("--purchases");
if (
  [
    acquisition,
    pricing,
    terminal,
    payables,
    journeys,
    medical,
    purchases,
  ].filter(Boolean).length > 1
)
  throw new Error("Escolha um único recorte de verificação.");
const focused =
  acquisition ||
  pricing ||
  terminal ||
  payables ||
  journeys ||
  medical ||
  purchases;
const envFile = process.env.CHECK_ENV_FILE ?? ".env";
const branch = spawnSync(
  "git",
  ["-c", `safe.directory=${process.cwd()}`, "branch", "--show-current"],
  { encoding: "utf8", windowsHide: true },
);
if (branch.status !== 0 || branch.stdout.trim() !== "hvb-sistema-dev")
  throw new Error("Verificação somente em hvb-sistema-dev.");
const steps = [
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  [
    "lint",
    [
      "node_modules/@biomejs/biome/bin/biome",
      "lint",
      "src",
      "scripts",
      "tests",
    ],
  ],
  [
    "format",
    [
      "node_modules/@biomejs/biome/bin/biome",
      "format",
      "src",
      "scripts",
      "tests",
      "package.json",
      "tsconfig.json",
      "biome.json",
    ],
  ],
  ["unit", ["--test", "tests/unit.test.ts"]],
  ["migrate", [`--env-file=${envFile}`, "scripts/migrate.ts"]],
  [
    "integration",
    [
      `--env-file=${envFile}`,
      "--test",
      "--test-concurrency=1",
      ...(acquisition
        ? [
            "tests/purchases.test.ts",
            "tests/purchase-pricing.test.ts",
            "tests/acquisition-cost.test.ts",
          ]
        : pricing
          ? ["tests/payables.test.ts", "tests/purchase-pricing.test.ts"]
          : terminal
            ? ["tests/integration.test.ts", "tests/terminal.test.ts"]
            : payables
              ? ["tests/purchases.test.ts", "tests/payables.test.ts"]
              : journeys
                ? ["tests/core-journeys.test.ts"]
                : medical
                  ? ["tests/clinical.test.ts", "tests/medical-record.test.ts"]
                  : purchases
                    ? ["tests/inventory.test.ts", "tests/purchases.test.ts"]
                    : [
                        "tests/integration.test.ts",
                        "tests/inventory.test.ts",
                        "tests/clinical.test.ts",
                        "tests/daily.test.ts",
                        "tests/financial.test.ts",
                        "tests/exams.test.ts",
                        "tests/preventive.test.ts",
                        "tests/documents.test.ts",
                        "tests/schedule.test.ts",
                        "tests/portal.test.ts",
                        "tests/purchases.test.ts",
                        "tests/medical-record.test.ts",
                        "tests/core-journeys.test.ts",
                        "tests/payables.test.ts",
                        "tests/terminal.test.ts",
                        "tests/purchase-pricing.test.ts",
                        "tests/acquisition-cost.test.ts",
                      ]),
    ],
  ],
  ["openapi", ["scripts/openapi.ts"]],
];
const results = [];
for (const [name, args] of steps) {
  const start = Date.now();
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
  });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  results.push({
    name,
    status: r.status,
    elapsed_ms: Date.now() - start,
    output: (r.stdout ?? "").trim(),
    error: (r.stderr ?? "").trim(),
  });
  if (r.status !== 0) break;
}
await mkdir("docs/evidencias", { recursive: true });
await writeFile(
  acquisition
    ? "docs/evidencias/checks-c7-focused.json"
    : pricing
      ? "docs/evidencias/checks-c6-focused.json"
      : terminal
        ? "docs/evidencias/checks-c5-focused.json"
        : payables
          ? "docs/evidencias/checks-c4-focused.json"
          : journeys
            ? "docs/evidencias/checks-c3-focused.json"
            : medical
              ? "docs/evidencias/checks-c2-focused.json"
              : purchases
                ? "docs/evidencias/checks-c1-focused.json"
                : "docs/evidencias/checks-c7-full.json",
  `${JSON.stringify({ executed_at: new Date().toISOString(), branch: branch.stdout.trim(), scope: focused ? (acquisition ? "custo de aquisição, compras e preços" : pricing ? "preços de compra e contas a pagar" : terminal ? "terminal simulado e fundação" : payables ? "contas a pagar e compras" : journeys ? "jornadas integradas do núcleo" : medical ? "prontuário e clínica" : "compras e estoque") : "completo", node: process.version, results }, null, 2)}\n`,
);
if (results.length !== steps.length || results.some((r) => r.status !== 0))
  process.exitCode = 1;
