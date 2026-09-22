import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const financialCorrections = process.argv.includes("--financial-corrections");
const terminalV1 = process.argv.includes("--terminal-v1");
const dailyCorrections = process.argv.includes("--daily-corrections");
const clinicalCorrections = process.argv.includes("--clinical-corrections");
const terminalAccess = process.argv.includes("--terminal-access");
const registry = process.argv.includes("--registry");
const linksAudit = process.argv.includes("--links-audit");
const medicalComplements = process.argv.includes("--medical-complements");
const supplierOutflow = process.argv.includes("--supplier-outflow");
const supplierCredit = process.argv.includes("--supplier-credit");
const installments = process.argv.includes("--installments");
const acquisition = process.argv.includes("--acquisition");
const pricing = process.argv.includes("--pricing");
const terminal = process.argv.includes("--terminal");
const payables = process.argv.includes("--payables");
const journeys = process.argv.includes("--journeys");
const medical = process.argv.includes("--medical");
const purchases = process.argv.includes("--purchases");
if (
  [
    terminalV1,
    financialCorrections,
    dailyCorrections,
    clinicalCorrections,
    terminalAccess,
    registry,
    linksAudit,
    medicalComplements,
    supplierOutflow,
    supplierCredit,
    installments,
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
  terminalV1 ||
  financialCorrections ||
  dailyCorrections ||
  clinicalCorrections ||
  terminalAccess ||
  registry ||
  linksAudit ||
  medicalComplements ||
  supplierOutflow ||
  supplierCredit ||
  installments ||
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
      ...(terminalV1
        ? [
            "tests/terminal-v1.test.ts",
            "tests/inventory.test.ts",
            "tests/terminal-access.test.ts",
            "tests/terminal.test.ts",
            "tests/clinical.test.ts",
          ]
        : financialCorrections
          ? [
              "tests/financial-corrections.test.ts",
              "tests/financial.test.ts",
              "tests/daily-corrections.test.ts",
            ]
          : dailyCorrections
            ? [
                "tests/daily-corrections.test.ts",
                "tests/daily.test.ts",
                "tests/financial.test.ts",
                "tests/clinical-corrections.test.ts",
              ]
            : clinicalCorrections
              ? [
                  "tests/clinical-corrections.test.ts",
                  "tests/clinical.test.ts",
                  "tests/daily.test.ts",
                  "tests/financial.test.ts",
                  "tests/exams.test.ts",
                  "tests/preventive.test.ts",
                  "tests/medical-record.test.ts",
                ]
              : terminalAccess
                ? [
                    "tests/integration.test.ts",
                    "tests/terminal.test.ts",
                    "tests/terminal-access.test.ts",
                  ]
                : registry
                  ? [
                      "tests/integration.test.ts",
                      "tests/registry-corrections.test.ts",
                      "tests/links-audit.test.ts",
                    ]
                  : linksAudit
                    ? [
                        "tests/integration.test.ts",
                        "tests/schedule.test.ts",
                        "tests/portal.test.ts",
                        "tests/links-audit.test.ts",
                      ]
                    : medicalComplements
                      ? [
                          "tests/medical-record.test.ts",
                          "tests/medical-complements.test.ts",
                        ]
                      : supplierOutflow
                        ? [
                            "tests/payables.test.ts",
                            "tests/supplier-outflow.test.ts",
                          ]
                        : supplierCredit
                          ? [
                              "tests/payables.test.ts",
                              "tests/supplier-installments.test.ts",
                              "tests/supplier-credit.test.ts",
                            ]
                          : installments
                            ? [
                                "tests/payables.test.ts",
                                "tests/supplier-installments.test.ts",
                              ]
                            : acquisition
                              ? [
                                  "tests/purchases.test.ts",
                                  "tests/purchase-pricing.test.ts",
                                  "tests/acquisition-cost.test.ts",
                                ]
                              : pricing
                                ? [
                                    "tests/payables.test.ts",
                                    "tests/purchase-pricing.test.ts",
                                  ]
                                : terminal
                                  ? [
                                      "tests/integration.test.ts",
                                      "tests/terminal.test.ts",
                                    ]
                                  : payables
                                    ? [
                                        "tests/purchases.test.ts",
                                        "tests/payables.test.ts",
                                      ]
                                    : journeys
                                      ? ["tests/core-journeys.test.ts"]
                                      : medical
                                        ? [
                                            "tests/clinical.test.ts",
                                            "tests/medical-record.test.ts",
                                          ]
                                        : purchases
                                          ? [
                                              "tests/inventory.test.ts",
                                              "tests/purchases.test.ts",
                                            ]
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
                                              "tests/supplier-installments.test.ts",
                                              "tests/supplier-credit.test.ts",
                                              "tests/supplier-outflow.test.ts",
                                              "tests/medical-complements.test.ts",
                                              "tests/links-audit.test.ts",
                                              "tests/registry-corrections.test.ts",
                                              "tests/terminal-access.test.ts",
                                              "tests/clinical-corrections.test.ts",
                                              "tests/daily-corrections.test.ts",
                                              "tests/financial-corrections.test.ts",
                                              "tests/terminal-v1.test.ts",
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
  terminalV1
    ? "docs/evidencias/checks-c18-focused.json"
    : financialCorrections
      ? "docs/evidencias/checks-c17-focused.json"
      : dailyCorrections
        ? "docs/evidencias/checks-c16-focused.json"
        : clinicalCorrections
          ? "docs/evidencias/checks-c15-focused.json"
          : terminalAccess
            ? "docs/evidencias/checks-c14-focused.json"
            : registry
              ? "docs/evidencias/checks-c13-focused.json"
              : linksAudit
                ? "docs/evidencias/checks-c12-focused.json"
                : medicalComplements
                  ? "docs/evidencias/checks-c11-focused.json"
                  : supplierOutflow
                    ? "docs/evidencias/checks-c10-focused.json"
                    : supplierCredit
                      ? "docs/evidencias/checks-c9-focused.json"
                      : installments
                        ? "docs/evidencias/checks-c8-focused.json"
                        : acquisition
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
                                      : "docs/evidencias/checks-c18-full.json",
  `${JSON.stringify({ executed_at: new Date().toISOString(), branch: branch.stdout.trim(), scope: focused ? (terminalV1 ? "Terminal v1, estoque, C5/C14 e clínica" : financialCorrections ? "correções do financeiro do cliente, financeiro e diárias" : dailyCorrections ? "correções de diárias, cobertura, financeiro e correção clínica" : clinicalCorrections ? "correção clínica e dependências: clínica, diárias, financeiro, exames, protocolos e prontuário" : terminalAccess ? "terminal de acesso V2, legado e fundação" : registry ? "cadastros, acesso, fundação e auditoria" : linksAudit ? "vínculos, auditoria, fundação, agenda e portal" : medicalComplements ? "complementos do prontuário e narrativa" : supplierOutflow ? "conciliação de saídas e contas a pagar" : supplierCredit ? "crédito de fornecedores, parcelas e contas a pagar" : installments ? "parcelas de fornecedores e contas a pagar" : acquisition ? "custo de aquisição, compras e preços" : pricing ? "preços de compra e contas a pagar" : terminal ? "terminal simulado e fundação" : payables ? "contas a pagar e compras" : journeys ? "jornadas integradas do núcleo" : medical ? "prontuário e clínica" : "compras e estoque") : "completo", node: process.version, results }, null, 2)}\n`,
);
if (results.length !== steps.length || results.some((r) => r.status !== 0))
  process.exitCode = 1;
