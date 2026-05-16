import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)

DB_PATH = os.path.join(PROJECT_DIR, "sql", "demo.db")
SQL_INIT_PATH = os.path.join(PROJECT_DIR, "sql", "demo.sql")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(PROJECT_DIR, "frontend")

os.makedirs(UPLOAD_DIR, exist_ok=True)

APP_TITLE = "APS智能排产演示系统"
APP_VERSION = "2.0.0"
