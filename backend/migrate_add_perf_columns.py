"""
SQLite DB 마이그레이션 스크립트
- ETFMaster 테이블에 수익률/변동성/샤프지수 컬럼 추가 (이미 존재하면 무시)
- Render 배포 후 최초 1회 실행 또는 main.py 시작 시 자동 호출
"""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./etf_data_v2.db")
# SQLite 경로 추출 (sqlite:///./... → ./...)
if DB_PATH.startswith("sqlite+aiosqlite:///"):
    DB_PATH = DB_PATH[len("sqlite+aiosqlite:///"):]
elif DB_PATH.startswith("sqlite:///"):
    DB_PATH = DB_PATH[len("sqlite:///"):]

NEW_COLUMNS = [
    ("return_1m", "REAL"),
    ("return_3m", "REAL"),
    ("return_6m", "REAL"),
    ("return_1y", "REAL"),
    ("volatility", "REAL"),
    ("sharpe", "REAL"),
    ("perf_updated_at", "TEXT"),
]


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[Migration] DB 파일 없음: {DB_PATH} — 새 테이블은 SQLAlchemy create_all로 생성됩니다.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 현재 컬럼 목록 조회
    cursor.execute("PRAGMA table_info(etf_master)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    added = []
    for col_name, col_type in NEW_COLUMNS:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE etf_master ADD COLUMN {col_name} {col_type}")
                added.append(col_name)
            except Exception as e:
                print(f"[Migration] {col_name} 추가 실패: {e}")

    conn.commit()
    conn.close()

    if added:
        print(f"[Migration] etf_master에 {len(added)}개 컬럼 추가: {added}")
    else:
        print("[Migration] 이미 모든 컬럼 존재. 변경 없음.")


if __name__ == "__main__":
    migrate()
