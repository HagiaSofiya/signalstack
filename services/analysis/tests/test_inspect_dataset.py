from pathlib import Path

import pytest

from app.tools.inspect_dataset import DatasetInspectionError, inspect_dataset


def write_csv(tmp_path: Path, content: str) -> Path:
    path = tmp_path / "sample.csv"
    path.write_text(content, encoding="utf-8")
    return path


def test_inspects_schema_types_missing_values_and_preview(tmp_path: Path) -> None:
    path = write_csv(
        tmp_path,
        "is_active,orders,joined_at,segment\n"
        "True,12,2025-01-02,enterprise\n"
        "False,,2025-01-03,starter\n"
        "True,7,,enterprise\n",
    )

    result = inspect_dataset(path)

    assert result["rowCount"] == 3
    assert result["columnCount"] == 4
    assert result["preview"][1]["orders"] is None
    assert {column["name"]: column["type"] for column in result["columns"]} == {
        "is_active": "boolean",
        "orders": "number",
        "joined_at": "date",
        "segment": "string",
    }
    assert next(column for column in result["columns"] if column["name"] == "orders")["missingCount"] == 1


def test_preview_is_limited_to_ten_rows(tmp_path: Path) -> None:
    rows = "value\n" + "\n".join(str(index) for index in range(25))

    result = inspect_dataset(write_csv(tmp_path, rows))

    assert result["rowCount"] == 25
    assert len(result["preview"]) == 10
    assert result["preview"][0]["value"] == 0
    assert result["preview"][-1]["value"] == 9


def test_infers_boolean_columns_with_empty_values(tmp_path: Path) -> None:
    result = inspect_dataset(write_csv(tmp_path, "enabled\ntrue\n\nfalse\n"))

    assert result["columns"] == [{"name": "enabled", "type": "boolean", "missingCount": 1, "uniqueCount": 2}]
    assert result["preview"][1]["enabled"] is None


def test_malformed_csv_raises_a_domain_error(tmp_path: Path) -> None:
    path = write_csv(tmp_path, "name,amount\nalpha,1,unexpected\n")

    with pytest.raises(DatasetInspectionError):
        inspect_dataset(path)


def test_empty_csv_raises_a_domain_error(tmp_path: Path) -> None:
    with pytest.raises(DatasetInspectionError):
        inspect_dataset(write_csv(tmp_path, ""))
