from pathlib import Path

import pytest

from app.tools.analyze_dataset import (
    AggregateRequest,
    ComparePeriodsRequest,
    DatasetAnalysisError,
    FilterAndAggregateRequest,
    GroupByRequest,
    SummarizeColumnRequest,
    analyze_dataset,
)


def write_sales_csv(tmp_path: Path) -> Path:
    path = tmp_path / "sales.csv"
    path.write_text(
        "date,channel,revenue,customer,category\n"
        "2026-07-01,Google,100,A,Tools\n"
        "2026-07-15,Google,50,B,Tools\n"
        "2026-07-20,Meta,80,A,Books\n"
        "2026-08-01,Google,40,C,Tools\n"
        "2026-08-10,Meta,120,A,Books\n"
        "2026-08-11,Meta,,D,Books\n",
        encoding="utf-8",
    )
    return path


def test_group_by_sums_and_sorts_metric(tmp_path: Path) -> None:
    request = GroupByRequest(
        filePath=str(write_sales_csv(tmp_path)),
        operation="group_by",
        parameters={"groupBy": ["channel"], "metric": "revenue", "aggregation": "sum", "sort": "desc"},
    )

    result = analyze_dataset(request.file_path, request)

    assert result["columnsUsed"] == ["channel", "revenue"]
    assert result["rows"] == [{"channel": "Meta", "revenue": 200}, {"channel": "Google", "revenue": 190}]


def test_aggregate_and_summarize_return_structured_statistics(tmp_path: Path) -> None:
    path = write_sales_csv(tmp_path)
    aggregate = AggregateRequest(
        filePath=str(path), operation="aggregate", parameters={"metric": "revenue", "aggregation": "sum"}
    )
    summary = SummarizeColumnRequest(
        filePath=str(path), operation="summarize_column", parameters={"column": "revenue"}
    )

    assert analyze_dataset(aggregate.file_path, aggregate)["rows"] == [{
        "metric": "revenue", "aggregation": "sum", "value": 390, "rowCount": 6
    }]
    summary_row = analyze_dataset(summary.file_path, summary)["rows"][0]
    assert summary_row["missingCount"] == 1
    assert summary_row["mean"] == 78


def test_compare_periods_calculates_change(tmp_path: Path) -> None:
    request = ComparePeriodsRequest(
        filePath=str(write_sales_csv(tmp_path)),
        operation="compare_periods",
        parameters={
            "dateColumn": "date",
            "metric": "revenue",
            "aggregation": "sum",
            "periods": [
                {"label": "July 2026", "start": "2026-07-01", "end": "2026-07-31"},
                {"label": "August 2026", "start": "2026-08-01", "end": "2026-08-31"},
            ],
        },
    )

    rows = analyze_dataset(request.file_path, request)["rows"]

    assert rows[0]["value"] == 230
    assert rows[1]["value"] == 160
    assert rows[2]["absoluteChange"] == -70
    assert rows[2]["percentChange"] == pytest.approx(-30.4347826)


def test_filter_and_aggregate_applies_validated_filters(tmp_path: Path) -> None:
    request = FilterAndAggregateRequest(
        filePath=str(write_sales_csv(tmp_path)),
        operation="filter_and_aggregate",
        parameters={
            "metric": "revenue",
            "aggregation": "sum",
            "filters": [{"column": "channel", "operator": "eq", "value": "Meta"}],
        },
    )

    assert analyze_dataset(request.file_path, request)["rows"][0]["value"] == 200


def test_invalid_column_includes_available_columns(tmp_path: Path) -> None:
    request = AggregateRequest(
        filePath=str(write_sales_csv(tmp_path)), operation="aggregate", parameters={"metric": "sales_total", "aggregation": "sum"}
    )

    with pytest.raises(DatasetAnalysisError, match="sales_total") as error:
        analyze_dataset(request.file_path, request)

    assert error.value.available_columns == ["date", "channel", "revenue", "customer", "category"]


def test_invalid_aggregation_is_rejected(tmp_path: Path) -> None:
    request = GroupByRequest(
        filePath=str(write_sales_csv(tmp_path)),
        operation="group_by",
        parameters={"groupBy": ["channel"], "metric": "customer", "aggregation": "mean"},
    )

    with pytest.raises(DatasetAnalysisError, match="requires a numeric column"):
        analyze_dataset(request.file_path, request)


def test_malformed_period_date_is_rejected(tmp_path: Path) -> None:
    request = ComparePeriodsRequest(
        filePath=str(write_sales_csv(tmp_path)),
        operation="compare_periods",
        parameters={
            "dateColumn": "date",
            "metric": "revenue",
            "aggregation": "sum",
            "periods": [
                {"label": "Bad", "start": "not-a-date", "end": "2026-07-31"},
                {"label": "August", "start": "2026-08-01", "end": "2026-08-31"},
            ],
        },
    )

    with pytest.raises(DatasetAnalysisError, match="not a valid date"):
        analyze_dataset(request.file_path, request)
