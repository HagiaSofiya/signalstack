"""Deterministic CSV inspection for the analysis service."""

from __future__ import annotations

import warnings

from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


class DatasetInspectionError(ValueError):
    """Raised when a CSV cannot be safely inspected."""


def _infer_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"

    non_missing = series.dropna()
    if not non_missing.empty:
        if all(isinstance(value, (bool, np.bool_)) for value in non_missing):
            return "boolean"
        boolean_values = {str(value).strip().lower() for value in non_missing}
        if boolean_values and boolean_values <= {"true", "false"}:
            return "boolean"
        parsed = pd.to_datetime(non_missing, errors="coerce", format="mixed")
        if parsed.notna().mean() >= 0.8:
            return "date"
    return "string"


def _json_value(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (float, np.floating)) and not np.isfinite(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()
    return value


def read_dataset(file_path: str | Path) -> pd.DataFrame:
    """Read a CSV once and normalize column names for downstream tools."""
    path = Path(file_path)
    if not path.is_file():
        raise DatasetInspectionError("Dataset file was not found")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", pd.errors.ParserWarning)
            frame = pd.read_csv(path, on_bad_lines="error", index_col=False, skip_blank_lines=False)
    except (pd.errors.EmptyDataError, pd.errors.ParserError, pd.errors.ParserWarning, UnicodeDecodeError) as error:
        raise DatasetInspectionError("The file is not a readable, well-formed CSV") from error
    except OSError as error:
        raise DatasetInspectionError("The dataset file could not be read") from error

    frame.columns = [str(name) for name in frame.columns]
    return frame


def inspect_dataset(file_path: str | Path) -> dict[str, Any]:
    """Read a CSV and return a JSON-safe schema and ten-row preview."""
    frame = read_dataset(file_path)

    columns = [
        {
            "name": str(name),
            "type": _infer_type(series),
            "missingCount": int(series.isna().sum()),
            "uniqueCount": int(series.nunique(dropna=True)),
        }
        for name, series in frame.items()
    ]

    preview = [
        {str(key): _json_value(value) for key, value in row.items()}
        for row in frame.head(10).to_dict(orient="records")
    ]

    return {
        "rowCount": int(len(frame.index)),
        "columnCount": int(len(frame.columns)),
        "columns": columns,
        "preview": preview,
    }
