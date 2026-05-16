import sqlite3
import os
from config import DB_PATH, SQL_INIT_PATH


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    if not os.path.exists(SQL_INIT_PATH):
        return
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=OFF")
    cursor = conn.cursor()
    with open(SQL_INIT_PATH, "r", encoding="utf-8") as f:
        sql = f.read()
    cursor.executescript(sql)
    conn.commit()
    conn.close()


def query(sql, params=None, one=False):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    rows = cursor.fetchall()
    conn.close()
    if one:
        return dict(rows[0]) if rows else None
    return [dict(r) for r in rows]


def execute(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id
