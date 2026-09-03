export class DatasetToolError extends Error {
  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "DatasetToolError";
  }
}
