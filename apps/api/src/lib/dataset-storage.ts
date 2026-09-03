import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { apiEnv } from "./env.js";

const defaultStorageDirectory = path.resolve(process.cwd(), "storage/datasets");

export function getStorageDirectory() {
  return path.resolve(apiEnv.DATA_STORAGE_DIR ?? defaultStorageDirectory);
}

export function sanitizeFilename(filename: string) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveDatasetFile(file: File) {
  const directory = getStorageDirectory();
  await mkdir(directory, { recursive: true });

  const filename = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const storagePath = path.join(directory, filename);
  await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));
  return storagePath;
}

export async function removeDatasetFile(storagePath: string) {
  await unlink(storagePath).catch(() => undefined);
}
