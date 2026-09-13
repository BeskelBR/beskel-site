import { DomainError } from "../core.ts";
const scale = 1000000n;
export function exact(value: string): bigint {
  if (!/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$/.test(value))
    throw new DomainError(400, "quantidade_decimal_invalida");
  const [whole, part = ""] = value.split(".");
  return BigInt(whole ?? "0") * scale + BigInt(part.padEnd(6, "0"));
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const v = value < 0n ? -value : value;
  return `${sign}${v / scale}.${(v % scale).toString().padStart(6, "0")}`;
}
export function multiply(a: string, b: string): string {
  const result = exact(a) * exact(b);
  if (result % scale !== 0n)
    throw new DomainError(400, "conversao_exige_mais_de_seis_casas");
  const value = decimal(result / scale);
  exact(value);
  return value;
}
