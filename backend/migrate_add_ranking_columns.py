"""
SQLite DB 마이그레이션 스크립트
- ETFMaster 테이블에 other_fee, transaction_fee, tracking_error, disparity_rate 컬럼 추가 (이미 존재하면 무시)
- 백엔드 구동 시 자동 가동
"""
import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./etf_data_v2.db")
if DB_PATH.startswith("sqlite+aiosqlite:///"):
    DB_PATH = DB_PATH[len("sqlite+aiosqlite:///"):]
elif DB_PATH.startswith("sqlite:///"):
    DB_PATH = DB_PATH[len("sqlite:///"):]

NEW_COLUMNS = [
    ("other_fee", "REAL"),
    ("transaction_fee", "REAL"),
    ("tracking_error", "REAL"),
    ("disparity_rate", "REAL"),
]


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[Migration-Ranking] DB 파일 없음: {DB_PATH} — 새 테이블은 SQLAlchemy create_all로 생성됩니다.")
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
                cursor.execute(f"ALTER TABLE etf_master ADD COLUMN {col_name} {col_type} DEFAULT 0.0")
                added.append(col_name)
            except Exception as e:
                print(f"[Migration-Ranking] {col_name} 추가 실패: {e}")

    conn.commit()
    conn.close()

    if added:
        print(f"[Migration-Ranking] etf_master에 {len(added)}개 컬럼 추가: {added}")
    else:
        print("[Migration-Ranking] 이미 모든 실질 비용/오차 컬럼 존재. 변경 없음.")


if __name__ == "__main__":
    migrate()
