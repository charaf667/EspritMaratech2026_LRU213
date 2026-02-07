"""
One-time script to grant CREATEDB to the omnia PG user.
Must be run by a PG superuser (e.g. postgres).

Usage:
  python scripts/setup_test_db.py
"""

import subprocess
import sys
import os

PG_HOST = os.environ.get("PGHOST", "localhost")
PG_PORT = os.environ.get("PGPORT", "5432")
PG_SUPERUSER = os.environ.get("PG_SUPERUSER", "postgres")
PG_SUPERPASS = os.environ.get("PG_SUPERPASS", "")
TARGET_USER = os.environ.get("PGUSER", "omnia")


def main():
    # Try using psycopg2 directly (no psql needed)
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. pip install psycopg2-binary")
        sys.exit(1)

    # Connect as superuser
    dsn_kwargs = {
        "host": PG_HOST,
        "port": PG_PORT,
        "user": PG_SUPERUSER,
        "dbname": "postgres",
    }
    if PG_SUPERPASS:
        dsn_kwargs["password"] = PG_SUPERPASS

    try:
        conn = psycopg2.connect(**dsn_kwargs)
    except Exception as e:
        print(f"Cannot connect as {PG_SUPERUSER}@{PG_HOST}:{PG_PORT}")
        print(f"Error: {e}")
        print()
        print("If your PG superuser has a password, set PG_SUPERPASS env var.")
        print("Or run this SQL manually as superuser:")
        print(f"  ALTER USER {TARGET_USER} CREATEDB;")
        sys.exit(1)

    conn.autocommit = True
    cur = conn.cursor()

    # Check current status
    cur.execute("SELECT rolcreatedb FROM pg_roles WHERE rolname = %s", (TARGET_USER,))
    row = cur.fetchone()
    if not row:
        print(f"ERROR: Role '{TARGET_USER}' does not exist in PostgreSQL.")
        sys.exit(1)

    if row[0]:
        print(f"[OK] User '{TARGET_USER}' already has CREATEDB.")
    else:
        cur.execute(f"ALTER USER {TARGET_USER} CREATEDB;")
        print(f"[OK] Granted CREATEDB to '{TARGET_USER}'.")

    # Ensure test_omnia DB doesn't have leftover state
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'test_omnia'")
    if cur.fetchone():
        print("[INFO] test_omnia database already exists (will be reused with --keepdb).")
    else:
        print("[INFO] test_omnia will be created on first test run.")

    cur.close()
    conn.close()
    print("\nDone. You can now run: python manage.py test")


if __name__ == "__main__":
    main()
