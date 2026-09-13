import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
export type ObjectMetadata = {
  key: string;
  sha256: string;
  size: number;
  contentType: string;
};
export interface PrivateStorage {
  put(
    org: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<ObjectMetadata>;
  get(org: string, key: string): Promise<Uint8Array>;
}
export class LocalPrivateStorage implements PrivateStorage {
  readonly root: string;
  constructor(root = path.resolve(".local/objects")) {
    const allowed = path.resolve(".local") + path.sep;
    this.root = path.resolve(root);
    if (!this.root.startsWith(allowed))
      throw new Error("Storage DEV deve ficar em .local.");
  }
  private file(org: string, key: string) {
    if (!/^[a-f0-9-]{36}$/.test(org) || !/^[a-f0-9-]{36}$/.test(key))
      throw new Error("Chave inválida.");
    return path.join(this.root, org, key);
  }
  async put(org: string, bytes: Uint8Array, contentType: string) {
    if (bytes.byteLength > 10 * 1024 * 1024)
      throw new Error("Objeto excede 10 MiB.");
    if (!["application/pdf", "image/png", "image/jpeg"].includes(contentType))
      throw new Error("Tipo não permitido.");
    const key = randomUUID();
    const file = this.file(org, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    return {
      key,
      size: bytes.byteLength,
      contentType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async get(org: string, key: string) {
    return readFile(this.file(org, key));
  }
}
