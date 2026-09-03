"""Safe, structured pandas operations for agent-driven dataset analysis."""

from __future__ import annotations

from typing import Annotated, Any, Literal, Union

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr

from app.tools.inspect_dataset import DatasetInspectionError, _infer_type, _json_value, read_dataset

Aggregation = Literal["sum", "mean", "median", "min", "max", "count", "nunique"]
SortDirection = Literal["asc", "desc"]
FilterOperator = Literal["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"]
ScalarValue = StrictStr | StrictInt | StrictFloat | StrictBool


class AnalysisModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class FilterCondition(AnalysisModel):
    column: str = Field(min_length=1)
    operator: FilterOperator
    value: ScalarValue | list[ScalarValue] | None = None


class AnalysisPeriod(AnalysisModel):
    label: str = Field(min_length=1, max_length=80)
    start: str = Field(min_length=1)
    end: str = Field(min_length=1)


class FiltersParameters(AnalysisModel):
    filters: list[FilterCondition] = Field(default_factory=list, max_length=50)


class SummarizeColumnParameters(FiltersParameters):
    column: str = Field(min_length=1)


class GroupByParameters(FiltersParameters):
    group_by: list[str] = Field(min_length=1, max_length=5, alias="groupBy")
    metric: str = Field(min_length=1)
    aggregation: Aggregation
    sort: SortDirection = "desc"
    limit: int = Field(default=20, ge=1, le=100)


class AggregateParameters(FiltersParameters):
    metric: str = Field(min_length=1)
    aggregation: Aggregation


class ComparePeriodsParameters(FiltersParameters):
    date_column: str = Field(min_length=1, alias="dateColumn")
    metric: str = Field(min_length=1)
    aggregation: Aggregation
    periods: list[AnalysisPeriod] = Field(min_length=2, max_length=2)


class TopValuesParameters(FiltersParameters):
    column: str = Field(min_length=1)
    metric: str | None = Field(default=None, min_length=1)
    aggregation: Aggregation = "sum"
    sort: SortDirection = "desc"
    limit: int = Field(default=5, ge=1, le=100)


class CorrelationParameters(FiltersParameters):
    column: str = Field(min_length=1)
    with_columns: list[str] | None = Field(default=None, min_length=1, max_length=50, alias="withColumns")


class FilterAndAggregateParameters(FiltersParameters):
    metric: str = Field(min_length=1)
    aggregation: Aggregation
    group_by: list[str] | None = Field(default=None, min_length=1, max_length=5, alias="groupBy")
    sort: SortDirection = "desc"
    limit: int = Field(default=20, ge=1, le=100)


class AnalysisRequestBase(AnalysisModel):
    file_path: str = Field(min_length=1, alias="filePath")


class SummarizeColumnRequest(AnalysisRequestBase):
    operation: Literal["summarize_column"]
    parameters: SummarizeColumnParameters


class GroupByRequest(AnalysisRequestBase):
    operation: Literal["group_by"]
    parameters: GroupByParameters


class AggregateRequest(AnalysisRequestBase):
    operation: Literal["aggregate"]
    parameters: AggregateParameters


class ComparePeriodsRequest(AnalysisRequestBase):
    operation: Literal["compare_periods"]
    parameters: ComparePeriodsParameters


class TopValuesRequest(AnalysisRequestBase):
    operation: Literal["top_values"]
    parameters: TopValuesParameters


class CorrelationRequest(AnalysisRequestBase):
    operation: Literal["correlation"]
    parameters: CorrelationParameters


class FilterAndAggregateRequest(AnalysisRequestBase):
    operation: Literal["filter_and_aggregate"]
    parameters: FilterAndAggregateParameters


class DatasetAnalysisResult(AnalysisModel):
    operation: Literal[
        "summarize_column",
        "group_by",
        "aggregate",
        "compare_periods",
        "top_values",
        "correlation",
        "filter_and_aggregate",
    ]
    columns_used: list[str] = Field(alias="columnsUsed")
    rows: list[dict[str, Any]] = Field(max_length=100)


AnalyzeDatasetRequest = Annotated[
    Union[
        SummarizeColumnRequest,
        GroupByRequest,
        AggregateRequest,
        ComparePeriodsRequest,
        TopValuesRequest,
        CorrelationRequest,
        FilterAndAggregateRequest,
    ],
    Field(discriminator="operation"),
]


class DatasetAnalysisError(ValueError):
    """An expected, user-correctable analysis request failure."""

    def __init__(self, message: str, available_columns: list[str] | None = None):
        super().__init__(message)
        self.available_columns = available_columns


def analyze_dataset(file_path: str, request: AnalyzeDatasetRequest) -> dict[str, Any]:
    """Execute one validated operation and return a bounded structured result."""
    try:
        frame = read_dataset(file_path)
    except DatasetInspectionError as error:
        raise DatasetAnalysisError(str(error)) from error

    if request.operation == "summarize_column":
        return _summarize_column(frame, request.parameters)
    if request.operation == "group_by":
        return _group_by(frame, request.parameters)
    if request.operation == "aggregate":
        return _aggregate_operation(frame, request.parameters)
    if request.operation == "compare_periods":
        return _compare_periods(frame, request.parameters)
    if request.operation == "top_values":
        return _top_values(frame, request.parameters)
    if request.operation == "correlation":
        return _correlation(frame, request.parameters)
    return _filter_and_aggregate(frame, request.parameters)


def _summarize_column(frame: pd.DataFrame, parameters: SummarizeColumnParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.column])
    filtered = _apply_filters(frame, parameters.filters)
    series = filtered[parameters.column]
    row: dict[str, Any] = {
        "column": parameters.column,
        "type": _infer_type(series),
        "count": int(series.count()),
        "missingCount": int(series.isna().sum()),
        "uniqueCount": int(series.nunique(dropna=True)),
        "min": _json_value(series.min()) if series.count() else None,
        "max": _json_value(series.max()) if series.count() else None,
    }
    if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
        row["sum"] = _json_value(series.sum())
        row["mean"] = _json_value(series.mean())
        row["median"] = _json_value(series.median())
    return _result("summarize_column", [parameters.column], [row])


def _group_by(frame: pd.DataFrame, parameters: GroupByParameters) -> dict[str, Any]:
    _require_columns(frame, [*parameters.group_by, parameters.metric])
    filtered = _apply_filters(frame, parameters.filters)
    grouped = _grouped_rows(filtered, parameters.group_by, parameters.metric, parameters.aggregation)
    return _result("group_by", _unique([*parameters.group_by, parameters.metric]), _sort_and_limit(grouped, parameters.metric, parameters.sort, parameters.limit))


def _aggregate_operation(frame: pd.DataFrame, parameters: AggregateParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.metric])
    filtered = _apply_filters(frame, parameters.filters)
    series = filtered[parameters.metric]
    row = {
        "metric": parameters.metric,
        "aggregation": parameters.aggregation,
        "value": _json_value(_aggregate(series, parameters.aggregation)),
        "rowCount": int(len(filtered.index)),
    }
    return _result("aggregate", [parameters.metric], [row])


def _compare_periods(frame: pd.DataFrame, parameters: ComparePeriodsParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.date_column, parameters.metric])
    filtered = _apply_filters(frame, parameters.filters)
    dates = pd.to_datetime(filtered[parameters.date_column], errors="coerce")
    if dates.notna().sum() == 0:
        raise DatasetAnalysisError(f"Column '{parameters.date_column}' does not contain valid dates")

    period_rows: list[dict[str, Any]] = []
    for period in parameters.periods:
        start = _parse_period_date(period.start, "start")
        end = _parse_period_date(period.end, "end")
        if start > end:
            raise DatasetAnalysisError(f"Period '{period.label}' has a start date after its end date")
        mask = dates.ge(start) & dates.le(end)
        selected = filtered.loc[mask.fillna(False)]
        period_rows.append({
            "period": period.label,
            "start": start.date().isoformat(),
            "end": end.date().isoformat(),
            "value": _json_value(_aggregate(selected[parameters.metric], parameters.aggregation)),
            "rowCount": int(len(selected.index)),
        })

    first_value = period_rows[0]["value"]
    second_value = period_rows[1]["value"]
    if _is_number(first_value) and _is_number(second_value):
        absolute_change = second_value - first_value
        percent_change = None if first_value == 0 else (absolute_change / first_value) * 100
    else:
        absolute_change = None
        percent_change = None
    period_rows.append({
        "comparison": f"{parameters.periods[1].label} vs {parameters.periods[0].label}",
        "absoluteChange": _json_value(absolute_change),
        "percentChange": _json_value(percent_change),
    })
    return _result("compare_periods", _unique([parameters.date_column, parameters.metric]), period_rows)


def _top_values(frame: pd.DataFrame, parameters: TopValuesParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.column, *([parameters.metric] if parameters.metric else [])])
    filtered = _apply_filters(frame, parameters.filters)
    if parameters.metric:
        rows = _grouped_rows(filtered, [parameters.column], parameters.metric, parameters.aggregation)
        rows = _sort_and_limit(rows, parameters.metric, parameters.sort, parameters.limit)
        return _result("top_values", _unique([parameters.column, parameters.metric]), rows)

    counts = filtered[parameters.column].value_counts(dropna=False)
    rows = [
        {parameters.column: _json_value(value), "count": int(count)}
        for value, count in counts.items()
    ]
    if parameters.sort == "asc":
        rows.reverse()
    return _result("top_values", [parameters.column], rows[: parameters.limit])


def _correlation(frame: pd.DataFrame, parameters: CorrelationParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.column, *(parameters.with_columns or [])])
    filtered = _apply_filters(frame, parameters.filters)
    if not pd.api.types.is_numeric_dtype(filtered[parameters.column]):
        raise DatasetAnalysisError(f"Column '{parameters.column}' must be numeric for correlation")

    candidates = parameters.with_columns or [
        str(column)
        for column in filtered.columns
        if column != parameters.column and pd.api.types.is_numeric_dtype(filtered[column])
    ]
    non_numeric = [column for column in candidates if not pd.api.types.is_numeric_dtype(filtered[column])]
    if non_numeric:
        raise DatasetAnalysisError(f"Correlation columns must be numeric: {', '.join(non_numeric)}")
    if not candidates:
        raise DatasetAnalysisError("No other numeric columns are available for correlation")

    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        pair = filtered[[parameters.column, candidate]].dropna()
        correlation = pair[parameters.column].corr(pair[candidate]) if len(pair.index) > 1 else np.nan
        if pd.notna(correlation):
            rows.append({"column": candidate, "correlation": _json_value(correlation), "sampleCount": int(len(pair.index))})
    rows.sort(key=lambda row: abs(float(row["correlation"])), reverse=True)
    return _result("correlation", _unique([parameters.column, *candidates]), rows)


def _filter_and_aggregate(frame: pd.DataFrame, parameters: FilterAndAggregateParameters) -> dict[str, Any]:
    _require_columns(frame, [parameters.metric, *(parameters.group_by or [])])
    filtered = _apply_filters(frame, parameters.filters)
    if parameters.group_by:
        rows = _grouped_rows(filtered, parameters.group_by, parameters.metric, parameters.aggregation)
        rows = _sort_and_limit(rows, parameters.metric, parameters.sort, parameters.limit)
    else:
        rows = [{
            "metric": parameters.metric,
            "aggregation": parameters.aggregation,
            "value": _json_value(_aggregate(filtered[parameters.metric], parameters.aggregation)),
            "rowCount": int(len(filtered.index)),
        }]
    return _result("filter_and_aggregate", _unique([*(parameters.group_by or []), parameters.metric]), rows)


def _grouped_rows(frame: pd.DataFrame, group_by: list[str], metric: str, aggregation: Aggregation) -> list[dict[str, Any]]:
    _validate_aggregation(frame[metric], aggregation)
    grouped = frame.groupby(group_by, dropna=False, sort=False)[metric].agg(aggregation).reset_index()
    return [
        {str(key): _json_value(value) for key, value in row.items()}
        for row in grouped.to_dict(orient="records")
    ]


def _sort_and_limit(rows: list[dict[str, Any]], metric: str, direction: SortDirection, limit: int) -> list[dict[str, Any]]:
    non_null = [row for row in rows if row.get(metric) is not None]
    null_rows = [row for row in rows if row.get(metric) is None]
    non_null.sort(key=lambda row: row.get(metric), reverse=direction == "desc")
    return (non_null + null_rows)[:limit]


def _aggregate(series: pd.Series, aggregation: Aggregation) -> Any:
    _validate_aggregation(series, aggregation)
    if aggregation == "count":
        return series.count()
    if aggregation == "nunique":
        return series.nunique(dropna=True)
    if aggregation == "sum":
        return series.sum()
    if aggregation == "mean":
        return series.mean()
    if aggregation == "median":
        return series.median()
    if aggregation == "min":
        return series.min()
    return series.max()


def _validate_aggregation(series: pd.Series, aggregation: Aggregation) -> None:
    if aggregation in {"sum", "mean", "median"} and (
        not pd.api.types.is_numeric_dtype(series) or pd.api.types.is_bool_dtype(series)
    ):
        raise DatasetAnalysisError(f"Aggregation '{aggregation}' requires a numeric column")


def _apply_filters(frame: pd.DataFrame, filters: list[FilterCondition]) -> pd.DataFrame:
    filtered = frame
    for condition in filters:
        _require_columns(filtered, [condition.column])
        series = filtered[condition.column]
        if condition.operator == "is_null":
            if condition.value is not None:
                raise DatasetAnalysisError(f"Filter 'is_null' for '{condition.column}' does not accept a value")
            mask = series.isna()
        elif condition.operator == "not_null":
            if condition.value is not None:
                raise DatasetAnalysisError(f"Filter 'not_null' for '{condition.column}' does not accept a value")
            mask = series.notna()
        else:
            if condition.operator == "in":
                if not isinstance(condition.value, list):
                    raise DatasetAnalysisError(f"Filter 'in' for '{condition.column}' requires a list value")
                value: Any = [_coerce_filter_value(series, item) for item in condition.value]
            else:
                if isinstance(condition.value, list) or condition.value is None:
                    raise DatasetAnalysisError(f"Filter '{condition.operator}' for '{condition.column}' requires one value")
                value = _coerce_filter_value(series, condition.value)
            try:
                if condition.operator == "eq":
                    mask = series == value
                elif condition.operator == "neq":
                    mask = series != value
                elif condition.operator == "gt":
                    mask = series > value
                elif condition.operator == "gte":
                    mask = series >= value
                elif condition.operator == "lt":
                    mask = series < value
                elif condition.operator == "lte":
                    mask = series <= value
                else:
                    mask = series.astype("string").str.contains(str(value), case=False, na=False)
            except (TypeError, ValueError) as error:
                raise DatasetAnalysisError(f"Filter '{condition.operator}' is incompatible with column '{condition.column}'") from error
        filtered = filtered.loc[mask.fillna(False)]
    return filtered


def _coerce_filter_value(series: pd.Series, value: ScalarValue) -> Any:
    if pd.api.types.is_datetime64_any_dtype(series) and isinstance(value, str):
        parsed = pd.to_datetime(value, errors="coerce")
        if pd.isna(parsed):
            raise DatasetAnalysisError(f"Filter value '{value}' is not a valid date")
        return parsed
    if pd.api.types.is_numeric_dtype(series) and isinstance(value, str):
        parsed = pd.to_numeric(value, errors="coerce")
        if pd.isna(parsed):
            raise DatasetAnalysisError(f"Filter value '{value}' is not numeric for column '{series.name}'")
        return parsed
    return value


def _parse_period_date(value: str, label: str) -> pd.Timestamp:
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        raise DatasetAnalysisError(f"Period {label} '{value}' is not a valid date")
    return pd.Timestamp(parsed)


def _require_columns(frame: pd.DataFrame, columns: list[str]) -> None:
    available = [str(column) for column in frame.columns]
    missing = _unique([column for column in columns if column not in available])
    if missing:
        names = ", ".join(f"'{column}'" for column in missing)
        raise DatasetAnalysisError(f"Column {names} does not exist", available)


def _result(operation: str, columns_used: list[str], rows: list[dict[str, Any]]) -> dict[str, Any]:
    return DatasetAnalysisResult(
        operation=operation,
        columnsUsed=_unique(columns_used),
        rows=rows[:100],
    ).model_dump(by_alias=True)


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool) and not pd.isna(value)
