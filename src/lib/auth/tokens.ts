import { createHash, randomBytes } from "node:crypto";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev-secret";
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
