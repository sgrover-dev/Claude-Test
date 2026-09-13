import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * File storage abstraction. Local disk for development / single-node deploys;
 * swap `LocalStorage` for an S3-compatible implementation without touching callers.
 */
export interface FileStorage {
  put(input: { data: Buffer; filename: string; contentType: string }): Promise<{ key: string; url: string }>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
}

const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

class LocalStorage implements FileStorage {
  async put({ data, filename, contentType }: { data: Buffer; filename: string; contentType: string }) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const key = `${randomUUID()}-${safe}`;
    await mkdir(ROOT, { recursive: true });
    await writeFile(path.join(ROOT, key), data);
    await writeFile(path.join(ROOT, `${key}.meta`), JSON.stringify({ contentType }));
    return { key, url: `/api/files/${encodeURIComponent(key)}` };
  }
  async get(key: string) {
    if (key.includes("/") || key.includes("..")) return null;
    try {
      const [data, meta] = await Promise.all([readFile(path.join(ROOT, key)), readFile(path.join(ROOT, `${key}.meta`), "utf8")]);
      return { data, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
    } catch {
      return null;
    }
  }
}

export const storage: FileStorage = new LocalStorage();
