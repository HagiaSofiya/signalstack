from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.tools.analyze_dataset import AnalyzeDatasetRequest, DatasetAnalysisError, DatasetAnalysisResult, analyze_dataset
from app.tools.inspect_dataset import DatasetInspectionError, inspect_dataset

app = FastAPI(
    title="SignalStack Analysis Service",
    version="0.1.0",
    description="A boundary for safe, reproducible dataset analysis tools.",
)


class InspectDatasetRequest(BaseModel):
    file_path: str = Field(min_length=1, alias="filePath")

    model_config = {"populate_by_name": True}


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Report service availability."""
    return {"status": "ok", "service": "signalstack-analysis"}


@app.post("/datasets/inspect", tags=["datasets"])
def inspect_dataset_route(request: InspectDatasetRequest) -> dict[str, Any]:
    """Inspect a CSV previously written by the TypeScript API."""
    try:
        return inspect_dataset(Path(request.file_path))
    except DatasetInspectionError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/datasets/analyze", response_model=DatasetAnalysisResult, tags=["datasets"])
def analyze_dataset_route(request: AnalyzeDatasetRequest) -> dict[str, Any]:
    """Execute one constrained pandas analysis operation."""
    try:
        return analyze_dataset(request.file_path, request)
    except DatasetAnalysisError as error:
        detail: dict[str, Any] = {"error": str(error)}
        if error.available_columns is not None:
            detail["availableColumns"] = error.available_columns
        raise HTTPException(status_code=422, detail=detail) from error
