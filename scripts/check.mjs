import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const focused = process.argv.includes("--purchases");
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
      ...(focused
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
  focused
    ? "docs/evidencias/checks-c1-focused.json"
    : "docs/evidencias/checks-c1-full.json",
  `${JSON.stringify({ executed_at: new Date().toISOString(), branch: branch.stdout.trim(), scope: focused ? "compras e estoque" : "completo", node: process.version, results }, null, 2)}\n`,
);
if (results.length !== steps.length || results.some((r) => r.status !== 0))
  process.exitCode = 1;
