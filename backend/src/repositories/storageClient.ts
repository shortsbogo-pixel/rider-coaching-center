import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface Repository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  save(item: T): Promise<T>;
  saveMany(items: T[]): Promise<T[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  exportData(): Promise<T[]>;
  importData(items: T[]): Promise<T[]>;
}

function dataPath(fileName: string) {
  return resolve(process.cwd(), "backend/src/data", fileName);
}

async function readArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      await writeArray(filePath, []);
      return [];
    }
    throw error;
  }
}

async function writeArray<T>(filePath: string, items: T[]) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export function createJsonRepository<T extends { id: string }>(fileName: string): Repository<T> {
  return {
    getAll: () => readArray<T>(dataPath(fileName)),
    async getById(id) {
      const filePath = dataPath(fileName);
      return (await readArray<T>(filePath)).find((item) => item.id === id);
    },
    async save(item) {
      const filePath = dataPath(fileName);
      const items = await readArray<T>(filePath);
      await writeArray(
        filePath,
        [...items.filter((current) => current.id !== item.id), item]
      );
      return item;
    },
    async saveMany(items) {
      const filePath = dataPath(fileName);
      const current = await readArray<T>(filePath);
      const next = current.filter((item) => !items.some((incoming) => incoming.id === item.id));
      next.push(...items);
      await writeArray(filePath, next);
      return items;
    },
    async remove(id) {
      const filePath = dataPath(fileName);
      const items = await readArray<T>(filePath);
      await writeArray(
        filePath,
        items.filter((item) => item.id !== id)
      );
    },
    async clear() {
      await writeArray(dataPath(fileName), []);
    },
    exportData: () => readArray<T>(dataPath(fileName)),
    async importData(items) {
      await writeArray(dataPath(fileName), items);
      return items;
    }
  };
}
