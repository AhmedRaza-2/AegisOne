"""Regression coverage for additive migrations on local SQLite databases."""

import asyncio
import logging

import pytest
from sqlalchemy import event, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from api.database import migrations


@pytest.mark.parametrize("partially_migrated", [False, True])
def test_sqlite_migrations_preserve_data_and_are_repeatable(partially_migrated):
    asyncio.run(_check_sqlite_migrations(partially_migrated))


async def _check_sqlite_migrations(partially_migrated):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    statements = []

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def capture_sql(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    try:
        async with engine.begin() as conn:
            await conn.execute(text("PRAGMA foreign_keys=ON"))
            for table in ("users", "departments", "incidents", "incident_reports"):
                await conn.execute(text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)"))
                await conn.execute(text(f"INSERT INTO {table} (id) VALUES (1)"))
            if partially_migrated:
                await conn.execute(text("ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP"))
                await conn.execute(text("UPDATE users SET password_changed_at='2026-10-19 12:00:00'"))

            await migrations.run_additive_migrations(conn)
            statements.clear()
            await migrations.run_additive_migrations(conn)
            assert not any(sql.startswith("ALTER TABLE") for sql in statements)

            for table, column, _ in migrations._ADDITIVE_COLUMNS:
                columns = await conn.run_sync(lambda sync: inspect(sync).get_columns(table))
                assert column in {item["name"] for item in columns}
                assert await conn.scalar(text(f"SELECT count(*) FROM {table}")) == 1
            if partially_migrated:
                assert await conn.scalar(text("SELECT password_changed_at FROM users")) == "2026-10-19 12:00:00"

            for table, column, target in (
                ("incidents", "escalated_by_id", "users"),
                ("incident_reports", "department_id", "departments"),
            ):
                foreign_keys = await conn.run_sync(lambda sync: inspect(sync).get_foreign_keys(table))
                assert any(
                    fk["constrained_columns"] == [column]
                    and fk["referred_table"] == target
                    for fk in foreign_keys
                )
                await conn.execute(text(f"UPDATE {table} SET {column}=1 WHERE id=1"))
                await conn.execute(text(f"DELETE FROM {target} WHERE id=1"))
                assert await conn.scalar(text(f"SELECT {column} FROM {table} WHERE id=1")) is None
    finally:
        await engine.dispose()


def test_failed_migration_is_isolated_and_reported(monkeypatch, caplog):
    asyncio.run(_check_failed_migration(monkeypatch, caplog))


async def _check_failed_migration(monkeypatch, caplog):
    monkeypatch.setattr(migrations, "_ADDITIVE_COLUMNS", [
        ("users", "invalid_column", "INTEGER DEFAULT ("),
        ("users", "valid_column", "TEXT"),
    ])
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        with caplog.at_level(logging.INFO, logger="aegisone.migrations"):
            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
                await migrations.run_additive_migrations(conn)
                await conn.execute(text("INSERT INTO users (id, valid_column) VALUES (1, 'kept')"))
                assert await conn.scalar(text("SELECT valid_column FROM users")) == "kept"
        assert "completed with 1 failure(s)" in caplog.text
        assert "Additive schema migrations applied." not in caplog.text
    finally:
        await engine.dispose()
