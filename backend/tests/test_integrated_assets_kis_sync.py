import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from main import app
from db.database import AsyncSessionLocal
from db.models import KisAccountMapping
from sqlalchemy import select, delete

client = TestClient(app)

@pytest.mark.asyncio
async def test_get_kis_mappings_auto_supplement_defaults():
    """DB에 매핑이 없더라도 기본 4대 KIS 계좌가 자동 보충되어 반환되는지 검증"""
    async with AsyncSessionLocal() as session:
        # 기존 테스트 매핑 정리
        await session.execute(delete(KisAccountMapping))
        await session.commit()

    response = client.get("/api/v1/my/kis-mappings")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 4

    acc_numbers = [item["account_no"] for item in data]
    assert "64490078-01" in acc_numbers
    assert "81060777-22" in acc_numbers
    assert "64896732-01" in acc_numbers
    assert "81060777-01" in acc_numbers

    # ISA 기본 카테고리 확인
    isa_item = next(item for item in data if item["account_no"] == "64490078-01")
    assert isa_item["category"] == "ISA"


@pytest.mark.asyncio
async def test_update_and_persist_kis_mapping():
    """사용자가 계좌 별칭 및 카테고리를 변경했을 때 DB에 저장되고 최우선 반영되는지 검증"""
    update_payload = {
        "mappings": [
            {
                "account_no": "64490078-01",
                "alias": "호야 전용 ISA",
                "category": "ISA",
                "country": "국내"
            }
        ]
    }
    post_res = client.post("/api/v1/my/kis-mappings", json=update_payload)
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "success"

    # 다시 조회 시 변경된 별칭 확인
    get_res = client.get("/api/v1/my/kis-mappings")
    assert get_res.status_code == 200
    items = get_res.json()
    target = next(i for i in items if i["account_no"] == "64490078-01")
    assert target["alias"] == "호야 전용 ISA"


@pytest.mark.asyncio
async def test_integrated_assets_returns_kis_accounts():
    """종합자산 조회 시 kis_accounts 배열이 최소 4개 기본 계좌 메타데이터를 포함하는지 검증"""
    response = client.get("/api/v1/my/integrated-assets")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert "kis_accounts" in body
    assert len(body["kis_accounts"]) >= 4

    account_nos = [acc["account_no"] for acc in body["kis_accounts"]]
    assert "64490078-01" in account_nos
    assert "81060777-22" in account_nos
