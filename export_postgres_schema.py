import asyncio
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from api.database.db import engine, Base
from api.database.models import (
    Organization, User, Device, WebsiteScan, SecurityEvent, DownloadEvent,
    CredentialEvent, ManualScan, XAIReport, Policy, ThreatReport, DashboardStatistic,
    AuditLog, HoverScan
)

def export_schema():
    with open("postgres_schema.sql", "w") as f:
        f.write("-- AegisOne PostgreSQL Production Schema\n")
        f.write("-- Generated for high-performance and end-to-end production setup.\n\n")
        
        # Iterate over all tables defined in Base.metadata
        for table in Base.metadata.sorted_tables:
            # Generate the CREATE TABLE statement using the PostgreSQL dialect
            create_stmt = str(CreateTable(table).compile(dialect=postgresql.dialect()))
            f.write(create_stmt.strip() + ";\n\n")
            
            # Generate CREATE INDEX statements
            for index in table.indexes:
                create_index_stmt = str(CreateIndex(index).compile(dialect=postgresql.dialect()))
                f.write(create_index_stmt.strip() + ";\n\n")
                
    print("✅ PostgreSQL schema successfully exported to postgres_schema.sql")

if __name__ == "__main__":
    export_schema()
