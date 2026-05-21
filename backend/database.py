import sqlite3
import os
import time
from config import DB_PATH, SQL_INIT_PATH


def get_connection():
    max_retries = 3
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            conn = sqlite3.connect(DB_PATH, timeout=30)
            conn.row_factory = sqlite3.Row
            # 使用更稳定的PRAGMA设置
            conn.execute("PRAGMA journal_mode=WAL")  # 改为WAL模式以支持并发读写
            conn.execute("PRAGMA synchronous=NORMAL")  # 改为NORMAL以提高稳定性
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA temp_store=MEMORY")
            return conn
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))  # 递增延迟重试
                continue
            else:
                raise


def init_db():
    if not os.path.exists(SQL_INIT_PATH):
        return

    conn = sqlite3.connect(DB_PATH, timeout=30)
    try:
        conn.execute("PRAGMA journal_mode=WAL")  # 改为WAL模式
        conn.execute("PRAGMA synchronous=NORMAL")  # 改为NORMAL
        conn.execute("PRAGMA foreign_keys=OFF")
        conn.execute("PRAGMA temp_store=MEMORY")
        cursor = conn.cursor()
        with open(SQL_INIT_PATH, "r", encoding="utf-8") as f:
            sql = f.read()
        cursor.executescript(sql)
        conn.commit()
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            time.sleep(1)
            cursor = conn.cursor()
            with open(SQL_INIT_PATH, "r", encoding="utf-8") as f:
                sql = f.read()
            cursor.executescript(sql)
            conn.commit()
        else:
            raise
    finally:
        conn.close()


def query(sql, params=None, one=False):
    max_retries = 3
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            rows = cursor.fetchall()
            conn.close()
            if one:
                return dict(rows[0]) if rows else None
            return [dict(r) for r in rows]
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            else:
                raise


def get_one(sql, params=None):
    max_retries = 3
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            row = cursor.fetchone()
            conn.close()
            return dict(row) if row else None
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            else:
                raise


def execute(sql, params=None):
    max_retries = 3
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            conn.commit()
            last_id = cursor.lastrowid
            conn.close()
            return last_id
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
                continue
            else:
                raise
