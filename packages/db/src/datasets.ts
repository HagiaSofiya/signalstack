import type { Prisma, Dataset as PrismaDataset } from "@prisma/client";
import {
  datasetDetailSchema,
  datasetInspectionSchema,
  type DatasetDetail,
  type DatasetInspection,
} from "@signalstack/schemas";

import { getDb } from "./client.js";

const defaultProjectId = "00000000-0000-0000-0000-000000000001";

function toDatasetDetail(dataset: PrismaDataset): DatasetDetail {
  const inspection = dataset.inspectedAt
    ? datasetInspectionSchema.parse({
        rowCount: dataset.rowCount ?? 0,
        columnCount: dataset.columnCount ?? 0,
        columns: dataset.columns ?? [],
        preview: dataset.preview ?? [],
      })
    : null;

  return datasetDetailSchema.parse({
    id: dataset.id,
    projectId: dataset.projectId,
    filename: dataset.filename,
    storagePath: dataset.storagePath,
    rowCount: dataset.rowCount,
    createdAt: dataset.createdAt.toISOString(),
    inspection,
  });
}

export async function persistDataset(input: {
  projectId?: string;
  filename: string;
  storagePath: string;
  inspection: DatasetInspection;
}): Promise<DatasetDetail> {
  const projectId = input.projectId ?? defaultProjectId;
  const db = getDb();

  await db.project.upsert({
    where: { id: projectId },
    update: {},
    create: {
      id: projectId,
      name: "Acme revenue",
      description: "Development project",
    },
  });

  const dataset = await db.dataset.create({
    data: {
      projectId,
      filename: input.filename,
      storagePath: input.storagePath,
      rowCount: input.inspection.rowCount,
      columnCount: input.inspection.columnCount,
      columns: input.inspection.columns as Prisma.InputJsonValue,
      preview: input.inspection.preview as Prisma.InputJsonValue,
      inspectedAt: new Date(),
    },
  });

  return toDatasetDetail(dataset);
}

export async function findDatasetDetail(
  id: string,
): Promise<DatasetDetail | null> {
  const dataset = await getDb().dataset.findUnique({ where: { id } });
  return dataset ? toDatasetDetail(dataset) : null;
}
