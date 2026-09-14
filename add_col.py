import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.database.db import engine
from sqlalchemy import text

async def alter():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE website_scans ADD COLUMN xai_explanation TEXT;"))
            print("Successfully added xai_explanation column to website_scans table.")
        except Exception as e:
            print(f"Error (column might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(alter())
