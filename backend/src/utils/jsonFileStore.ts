import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

const writeQueues = new Map<string, Promise<void>>();

interface JsonFileStoreOptions {
  backupCorrupted?: boolean;
}

export function operationDataPath(fileName: string, rootDir = resolve(process.cwd(), "backend/data")) {
  return resolve(rootDir, fileName);
}

async function ensureParent(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

function corruptBackupPath(filePath: string) {
  const extension = extname(filePath) || ".json";
  const fileBaseName = basename(filePath, extension);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(dirname(filePath), `${fileBaseName}.corrupt-${timestamp}${extension}`);
}

async function backupCorruptedJson(filePath: string) {
  try {
    await ensureParent(filePath);
    await rename(filePath, corruptBackupPath(filePath));
  } catch {
    // Recovery must continue even if the backup rename fails.
  }
}

export async function readJsonArraySafe<T>(filePath: string, options: JsonFileStoreOptions = {}): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    if (options.backupCorrupted) {
      await backupCorruptedJson(filePath);
      await writeJsonArrayQueued(filePath, []);
    }
    return [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      await writeJsonArrayQueued(filePath, []);
      return [];
    }
    if (options.backupCorrupted) {
      await backupCorruptedJson(filePath);
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

export function createJsonFileCollection<T extends { id: string }>(fileName: string, rootDir?: string, options: JsonFileStoreOptions = {}) {
  const filePath = operationDataPath(fileName, rootDir);
  return {
    async getAll() {
      return readJsonArraySafe<T>(filePath, options);
    },
    async save(item: T) {
      const items = await readJsonArraySafe<T>(filePath, options);
      await writeJsonArrayQueued(filePath, [...items.filter((current) => current.id !== item.id), item]);
      return item;
    },
    async saveMany(items: T[]) {
      const current = await readJsonArraySafe<T>(filePath, options);
      const incomingIds = new Set(items.map((item) => item.id));
      await writeJsonArrayQueued(filePath, [...current.filter((item) => !incomingIds.has(item.id)), ...items]);
      return items;
    },
    async delete(id: string) {
      const current = await readJsonArraySafe<T>(filePath, options);
      const next = current.filter((item) => item.id !== id);
      await writeJsonArrayQueued(filePath, next);
      return next.length !== current.length;
    }
  };
}
