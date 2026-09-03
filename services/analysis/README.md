# SignalStack analysis service

FastAPI boundary for Python-based dataset inspection and analysis tools.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Endpoints:

- `GET /health`
- `POST /datasets/inspect` for schema, missing-value, unique-count, and preview metadata.
- `POST /datasets/analyze` for validated operations: `summarize_column`, `group_by`, `aggregate`, `compare_periods`, `top_values`, `correlation`, and `filter_and_aggregate`.

The analysis endpoint accepts a dataset file path plus a Pydantic-validated operation. It never accepts Python or pandas code from callers. Every result is bounded to 100 rows and returns `operation`, `columnsUsed`, and `rows`; chart creation applies a stricter 50-point rendering cap.
