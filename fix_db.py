import asyncio
import asyncpg

async def run():
    print("Connecting to database...")
    conn = await asyncpg.connect('postgresql://aegis_user:admin123@localhost:5432/aegisone')
    print("Adding avatar_url column to users table if it doesn't exist...")
    try:
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);')
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;')
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;')
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason TEXT;')
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER;')
        await conn.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50);')
        print("Successfully added missing columns.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
