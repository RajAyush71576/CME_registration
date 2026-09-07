"""Converts an ORM row to a plain dict, so router business logic written
against dict-style access (`row["field"]`, `row.get("field")`) — carried
over unchanged from the excel_store.py era — keeps working against
Postgres-backed models without a rewrite."""


def row_to_dict(obj) -> dict | None:
    if obj is None:
        return None
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
