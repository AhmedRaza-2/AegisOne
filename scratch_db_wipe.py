import asyncio
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.database.db import async_session
from sqlalchemy import text

async def cleanup():
    async with async_session() as session:
        print("Safely wiping records from all existing database tables...")
        # Inspect available tables dynamically in PostgreSQL catalog
        result = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """))
        tables = [row[0] for row in result.fetchall()]
        
        if not tables:
            print("No tables found in public schema to truncate.")
            return

        table_list_str = ", ".join(tables)
        print(f"Truncating tables: {table_list_str}")
        
        await session.execute(text(f"TRUNCATE TABLE {table_list_str} RESTART IDENTITY CASCADE;"))
        await session.commit()
        print("Successfully wiped all database records! (Database schema preserved)")

if __name__ == "__main__":
    asyncio.run(cleanup())
