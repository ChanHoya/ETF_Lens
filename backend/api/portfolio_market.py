"""
Portfolio Market API
공유 포트폴리오 업로드 / 조회 / 다운로드 / 삭제
"""
import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.database import get_db
from db.models import SharedPortfolio

router = APIRouter(prefix="/portfolio-market", tags=["portfolio-market"])

# ── 마스터 PIN (sha256) ──────────────────────────────────────────────────
_MASTER_PIN_HASH = hashlib.sha256("1384".encode()).hexdigest()


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.strip().encode()).hexdigest()


# ── Pydantic 모델 ─────────────────────────────────────────────────────────
class PortfolioItem(BaseModel):
    code: str
    name: str


class UploadRequest(BaseModel):
    name: str
    author: str
    pin: str          # 4자리 숫자 권장 (제한 없음)
    items: List[PortfolioItem]


class DeleteRequest(BaseModel):
    pin: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────

@router.get("")
async def list_portfolios(db: AsyncSession = Depends(get_db)):
    """마켓에 공개된 포트폴리오 전체 목록 (다운로드 수 내림차순)"""
    result = await db.execute(
        select(SharedPortfolio).order_by(desc(SharedPortfolio.download_count), desc(SharedPortfolio.created_at))
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "author": r.author,
            "items": json.loads(r.items_json),
            "download_count": r.download_count,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in rows
    ]


@router.post("", status_code=201)
async def upload_portfolio(req: UploadRequest, db: AsyncSession = Depends(get_db)):
    """포트폴리오 업로드"""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="포트폴리오 이름을 입력하세요.")
    if not req.author.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not req.pin.strip():
        raise HTTPException(status_code=400, detail="PIN을 입력하세요.")
    if len(req.items) == 0:
        raise HTTPException(status_code=400, detail="종목이 없는 포트폴리오는 업로드할 수 없습니다.")

    new_portfolio = SharedPortfolio(
        name=req.name.strip(),
        author=req.author.strip(),
        items_json=json.dumps([item.dict() for item in req.items], ensure_ascii=False),
        pin_hash=_hash_pin(req.pin),
        download_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(new_portfolio)
    await db.commit()
    await db.refresh(new_portfolio)
    return {"id": new_portfolio.id, "message": "업로드 완료"}


@router.post("/{portfolio_id}/download")
async def increment_download(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """다운로드 카운트 증가"""
    result = await db.execute(select(SharedPortfolio).where(SharedPortfolio.id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")
    portfolio.download_count += 1
    await db.commit()
    return {"message": "ok"}


@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: int, req: DeleteRequest, db: AsyncSession = Depends(get_db)):
    """PIN 검증 후 삭제 (본인 PIN 또는 마스터 PIN 1384)"""
    result = await db.execute(select(SharedPortfolio).where(SharedPortfolio.id == portfolio_id))
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")

    entered_hash = _hash_pin(req.pin)
    if entered_hash != portfolio.pin_hash and entered_hash != _MASTER_PIN_HASH:
        raise HTTPException(status_code=403, detail="PIN이 올바르지 않습니다.")

    await db.delete(portfolio)
    await db.commit()
    return {"message": "삭제 완료"}
