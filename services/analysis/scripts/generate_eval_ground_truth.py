"""Generate deterministic evaluation facts from the SignalStack demo CSV."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
CSV_PATH = ROOT / "services" / "analysis" / "examples" / "signalstack-demo.csv"
CASES_PATH = ROOT / "evals" / "cases.json"
OUTPUT_PATH = ROOT / "evals" / "ground-truth.json"


def fact(field: str, value: object, tolerance: float | None = None) -> dict[str, object]:
    result: dict[str, object] = {"field": field, "value": value}
    if tolerance is not None:
        result["tolerance"] = tolerance
    return result


def generate() -> dict[str, object]:
    frame = pd.read_csv(CSV_PATH, parse_dates=["date"])
    grouped_channel = frame.groupby("channel", sort=False)["revenue"].sum().sort_values(ascending=False)
    grouped_category = frame.groupby("category", sort=False)["revenue"].mean().sort_values(ascending=False)
    grouped_product = frame.groupby("product", sort=False)["revenue"].sum().sort_values(ascending=False)
    grouped_region_orders = frame.groupby("region", sort=False)["orders"].sum().sort_values(ascending=False)
    april = frame.loc[frame["date"].dt.month == 4, "revenue"].sum()
    may = frame.loc[frame["date"].dt.month == 5, "revenue"].sum()
    correlation = frame["orders"].corr(frame["revenue"])

    facts = {
        "schema-inspection": [fact("rowCount", int(len(frame))), fact("columnCount", int(len(frame.columns)))],
        "missing-values": [fact("missingCount", 0)],
        "total-revenue": [fact("value", int(frame["revenue"].sum()))],
        "top-channel-revenue": [fact("channel", str(grouped_channel.index[0])), fact("revenue", int(grouped_channel.iloc[0]))],
        "average-category-revenue": [fact("category", str(grouped_category.index[0])), fact("revenue", float(grouped_category.iloc[0]), 0.01)],
        "april-vs-may": [fact("period", "May"), fact("value", int(may)), fact("absoluteChange", int(may - april)), fact("percentChange", float((may - april) / april * 100), 0.01)],
        "west-revenue-filter": [fact("value", int(frame.loc[frame["region"] == "West", "revenue"].sum()))],
        "top-products": [fact("product", str(grouped_product.index[0])), fact("revenue", int(grouped_product.iloc[0]))],
        "revenue-orders-correlation": [fact("column", "revenue"), fact("correlation", float(correlation), 0.01)],
        "monthly-revenue-chart": [fact("date", "2026-01-05"), fact("revenue", 18400)],
        "orders-revenue-scatter": [fact("correlation", float(correlation), 0.01)],
        "unsupported-weather": [],
        "invalid-column-recovery": [],
        "top-regions-by-orders": [fact("region", str(grouped_region_orders.index[0])), fact("orders", int(grouped_region_orders.iloc[0]))],
        "electronics-revenue-filter": [fact("value", int(frame.loc[frame["category"] == "Electronics", "revenue"].sum()))],
    }

    suite = json.loads(CASES_PATH.read_text())
    cases = suite["cases"]
    return {
        "suiteId": suite["suiteId"],
        "suiteVersion": suite["version"],
        "datasetVersion": suite["datasetVersion"],
        "dataset": str(CSV_PATH.relative_to(ROOT)),
        "cases": [{"caseId": case["id"], "expectedAnswerFacts": facts[case["id"]]} for case in cases],
    }


if __name__ == "__main__":
    OUTPUT_PATH.write_text(json.dumps(generate(), indent=2) + "\n")
    print(f"Wrote {OUTPUT_PATH}")
