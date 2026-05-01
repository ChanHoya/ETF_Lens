# Python Style Guide — ETF Lens Backend

> **제1 원칙**: [`conductor/index.md` → Karpathy's Laws](../index.md) 준수.
> 단순함 우선 · 외과적 변경 · 구현 전 질문.

## 기본 규칙

- Python 3.11+, 타입 힌트 사용 권장
- 함수명: `snake_case`, 클래스: `PascalCase`
- 비동기 우선: FastAPI endpoint는 모두 `async def`

## FastAPI 패턴

```python
# ✅ 올바른 패턴
@router.get("/endpoint")
async def my_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """독스트링으로 API 목적 설명."""
    try:
        # 로직
        return {"status": "ok", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("...")
        raise HTTPException(status_code=500, detail=str(e))
```

## KIS API 호출 규칙

```python
# ✅ Rate limit 보호 필수
await asyncio.sleep(1.2)  # KIS 초당 1건 제한

# ✅ EGW00133 처리
if msg_cd == "EGW00133" or "초과" in str(msg1):
    await asyncio.sleep(2.5)
    return None  # 재시도 루프로 위임
```

## DB 접근

```python
# ✅ SQLAlchemy async
from sqlalchemy import select
result = await db.execute(select(MyModel).where(MyModel.id == id))
row = result.scalar_one_or_none()

# ✅ Upsert 패턴
if row:
    row.field = new_value
else:
    db.add(MyModel(field=new_value))
await db.commit()
```

## 로깅

```python
logger = logging.getLogger(__name__)
logger.debug("상세 정보")    # 개발용
logger.info("정상 흐름")     # 주요 이벤트
logger.warning("비정상 상황") # 재시도 가능한 오류
logger.error("오류 발생")     # 기능 실패
logger.exception("예외")      # Exception with traceback
```
