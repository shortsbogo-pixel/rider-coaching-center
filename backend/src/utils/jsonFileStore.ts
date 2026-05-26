import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const writeQueues = new Map<string, Promise<void>>();

export function operationDataPath(fileName: string, rootDir = resolve(process.cwd(), "backend/data")) {
  return resolve(rootDir, fileName);
}

async function ensureParent(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function readJsonArraySafe<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      await writeJsonArrayQueued(filePath, []);
      return [];
    }
    await writeJsonArrayQueued(filePath, []);
    return [];
  }
}

export async function writeJsonArrayQueued<T>(filePath: string, items: T[]) {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await ensureParent(filePath);
      await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
    });
  writeQueues.set(filePath, next);
  await next;
}

export function createJsonFileCollection<T extends { id: string }>(fileName: string, rootDir?: string) {
  const filePath = operationDataPath(fileName, rootDir);
  return {
    async getAll() {
      return readJsonArraySafe<T>(filePath);
    },
    async save(item: T) {
      const items = await readJsonArraySafe<T>(filePath);
      await writeJsonArrayQueued(filePath, [...items.filter((current) => current.id !== item.id), item]);
      return item;
    },
    async saveMany(items: T[]) {
      const current = await readJsonArraySafe<T>(filePath);
      const incomingIds = new Set(items.map((item) => item.id));
      await writeJsonArrayQueued(filePath, [...current.filter((item) => !incomingIds.has(item.id)), ...items]);
      return items;
    },
    async delete(id: string) {
      const current = await readJsonArraySafe<T>(filePath);
      const next = current.filter((item) => item.id !== id);
      await writeJsonArrayQueued(filePath, next);
      return next.length !== current.length;
    }
  };
}
