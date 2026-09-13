import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { digest } from "../src/domain/core.ts";
import { permissions } from "../src/domain/schemas.ts";
import { pool, transaction } from "../src/persistence/database.ts";

export async function seedFixture(url: string) {
  const db = pool(url, 1);
  const org = randomUUID(),
    unit = randomUUID(),
    otherUnit = randomUUID();
  const admin = randomUUID(),
    nurse = randomUUID(),
    reader = randomUUID();
  const adminRole = randomUUID(),
    nurseRole = randomUUID(),
    readerRole = randomUUID();
  const adminToken = randomBytes(32).toString("hex"),
    nurseToken = randomBytes(32).toString("hex"),
    readerToken = randomBytes(32).toString("hex");
  const credential = randomUUID();
  try {
    await transaction(db, org, async (tx) => {
      await tx.query(
        "INSERT INTO organizacao(id,nome) VALUES($1,'Hospital Fictício DEV — sem dados reais')",
        [org],
      );
      await tx.query(
        "INSERT INTO unidade_hospitalar(id,organizacao_id,nome) VALUES($1,$3,'Unidade Sintética A'),($2,$3,'Unidade Sintética B')",
        [unit, otherUnit, org],
      );
      await tx.query(
        "INSERT INTO usuario(id,organizacao_id,nome,login) VALUES($1,$4,'Pessoa Fictícia Admin','admin.dev'),($2,$4,'Pessoa Fictícia Operador','operador.dev'),($3,$4,'Pessoa Fictícia Consulta','consulta.dev')",
        [admin, nurse, reader, org],
      );
      await tx.query(
        "INSERT INTO papel(id,organizacao_id,nome) VALUES($1,$4,'Admin DEV proposto'),($2,$4,'Operador DEV proposto'),($3,$4,'Consulta DEV proposta')",
        [adminRole, nurseRole, readerRole, org],
      );
      await tx.query(
        "INSERT INTO permissao(codigo) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",
        [permissions],
      );
      await tx.query(
        "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[])",
        [org, adminRole, permissions],
      );
      await tx.query(
        "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[])",
        [
          org,
          nurseRole,
          [
            "episodios:ler",
            "episodios:escrever",
            "locais:ler",
            "dispositivos:usar",
          ],
        ],
      );
      await tx.query(
        "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'cadastros:ler')",
        [org, readerRole],
      );
      for (const [user, role, scope] of [
        [admin, adminRole, null],
        [nurse, nurseRole, unit],
        [reader, readerRole, null],
      ]) {
        await tx.query(
          "INSERT INTO usuario_papel(id,organizacao_id,usuario_id,papel_id,unidade_id) VALUES($1,$2,$3,$4,$5)",
          [randomUUID(), org, user, role, scope],
        );
      }
      for (const [user, token, id] of [
        [admin, adminToken, credential],
        [nurse, nurseToken, randomUUID()],
        [reader, readerToken, randomUUID()],
      ]) {
        await tx.query(
          "INSERT INTO credencial(id,organizacao_id,usuario_id,tipo,token_hash,expira_em) VALUES($1,$2,$3,'api',$4,now()+interval '7 days')",
          [id, org, user, digest(token ?? "")],
        );
      }
    });
    return {
      org,
      unit,
      otherUnit,
      admin,
      nurse,
      reader,
      adminRole,
      nurseRole,
      readerRole,
      credential,
      adminToken,
      nurseToken,
      readerToken,
    };
  } finally {
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const target = ".local/dev-access.json";
  if (
    await access(target).then(
      () => true,
      () => false,
    )
  ) {
    const saved = JSON.parse(await readFile(target, "utf8"));
    const db = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1);
    try {
      const found = await db.query(
        "SELECT 1 FROM hvb.organizacao WHERE id=$1",
        [saved.org],
      );
      if (!found.rowCount)
        throw new Error(
          "Seed local salvo sem organização correspondente. Preserve e investigue.",
        );
      console.log(
        "Seed existente preservado. Credenciais locais em .local/dev-access.json.",
      );
    } finally {
      await db.end();
    }
  } else {
    const fixture = await seedFixture(process.env.MIGRATION_DATABASE_URL ?? "");
    await mkdir(".local", { recursive: true });
    await writeFile(target, `${JSON.stringify(fixture, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      "Seed fictício criado. Acesso apenas em .local/dev-access.json (não versionado).",
    );
  }
}
