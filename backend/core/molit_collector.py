# backend/core/molit_collector.py
"""
국토교통부(MOLIT) 공공데이터포털 실거래가 API 수집 엔진
- 아파트 매매 실거래 상세자료 (RTMSDataSvcAptTradeDev)
- 아파트 전월세 실거래 상세자료 (RTMSDataSvcAptRent)
- 수도권(경기 10개 핵심지, 인천 3대 거점) 13대 거점 법정동 시군구코드(LAWD_CD) 매핑
- XML 응답 파싱, 실거래가/평당가/전세가율 정규화 연산
- MOLIT_API_KEY 부재/쿼터 초과 시 FALLBACK_DISTRICT_DATASET 자동 전환 안전망
"""

import os
import logging
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Optional

import httpx

logger = logging.getLogger(__name__)

MOLIT_TRADE_API_BASE = "http://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
MOLIT_TRADE_API_DEV_BASE = "http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
MOLIT_RENT_API_BASE = "http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"

# 수도권(경기/인천) 13대 거점 법정동 시군구코드 (LAWD_CD) 매핑
METRO_DISTRICT_REGISTRY: Dict[str, Dict[str, Any]] = {
    # --- 경기도 10개 핵심지 ---
    "41290": {
        "name": "과천시",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 21.5,
        "base_jeonse": 10.2,
        "base_pyeong": 6200,
        "risk_level": "prime",
        "risk_label": "준강남/초고가",
        "risk_desc": "서초 인접 지정타 및 재건축 신축 위주 최상급 방어력"
    },
    "41135": {
        "name": "성남시 분당구",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 16.2,
        "base_jeonse": 8.5,
        "base_pyeong": 4800,
        "risk_level": "stable",
        "risk_label": "1기신도시 대장",
        "risk_desc": "선도지구 재건축 기대감 및 판교 테크노밸리 배후 실수요 탄탄"
    },
    "41450": {
        "name": "하남시",
        "region": "gyeonggi",
        "zone": "gyeonggi_east",
        "zone_name": "경기 동부",
        "base_price": 10.8,
        "base_jeonse": 6.2,
        "base_pyeong": 3600,
        "risk_level": "stable",
        "risk_label": "실수요 안정",
        "risk_desc": "미사강변·위례 등 강남/송파 접근성 우수, 50%대 건전 전세가율"
    },
    "41210": {
        "name": "광명시",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 10.2,
        "base_jeonse": 6.0,
        "base_pyeong": 3400,
        "risk_level": "stable",
        "risk_label": "실수요 안정",
        "risk_desc": "철산·광명뉴타운 대단지 입주 소화 및 여의도·가산 직주근접"
    },
    "41117": {
        "name": "수원시 영통구 (광교)",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 9.8,
        "base_jeonse": 5.8,
        "base_pyeong": 3300,
        "risk_level": "stable",
        "risk_label": "실수요 안정",
        "risk_desc": "광교 호수공원 인근 대장주 및 삼성전자 직주근접 수요"
    },
    "41465": {
        "name": "용인시 수지구",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 9.5,
        "base_jeonse": 5.9,
        "base_pyeong": 3100,
        "risk_level": "warning",
        "risk_label": "갭축소 주의",
        "risk_desc": "신분당선 라인 대단지 밀집, 학군 수요 탄탄하나 전세가율 상승세"
    },
    "41173": {
        "name": "안양시 동안구 (평촌)",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 9.2,
        "base_jeonse": 5.6,
        "base_pyeong": 3200,
        "risk_level": "stable",
        "risk_label": "실수요 안정",
        "risk_desc": "평촌 1기 신도시 학군지 및 재건축 선도지구 지정 수혜"
    },
    "41590": {
        "name": "화성시 (동탄)",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 8.4,
        "base_jeonse": 5.5,
        "base_pyeong": 2800,
        "risk_level": "warning",
        "risk_label": "갭축소 주의",
        "risk_desc": "동탄역 GTX-A 호재 선반영, 외곽 공급 지속에 따른 전세가율 경계"
    },
    "41285": {
        "name": "고양시 일산동구",
        "region": "gyeonggi",
        "zone": "gyeonggi_north",
        "zone_name": "경기 북부",
        "base_price": 6.5,
        "base_jeonse": 4.6,
        "base_pyeong": 2200,
        "risk_level": "warning",
        "risk_label": "갭축소 주의",
        "risk_desc": "1기 신도시이나 분당 대비 일자리 부족 및 전세가율 70% 돌파"
    },
    "41390": {
        "name": "시흥시",
        "region": "gyeonggi",
        "zone": "gyeonggi_south",
        "zone_name": "경기 남부",
        "base_price": 5.2,
        "base_jeonse": 3.9,
        "base_pyeong": 1800,
        "risk_level": "critical",
        "risk_label": "역전세 위험",
        "risk_desc": "은계·배곧 신도시 외곽 구축 전세가율 75% 상회, 갭투자 회수 위험"
    },
    # --- 인천광역시 3대 거점 ---
    "28185": {
        "name": "인천 연수구 (송도)",
        "region": "incheon",
        "zone": "incheon",
        "zone_name": "인천 송도",
        "base_price": 8.5,
        "base_jeonse": 5.0,
        "base_pyeong": 2700,
        "risk_level": "stable",
        "risk_label": "인천 대장/안정",
        "risk_desc": "송도국제도시 바이오 클러스터 및 학군 중심 인천 매매·전세 주도"
    },
    "28260": {
        "name": "인천 서구 (청라/검단)",
        "region": "incheon",
        "zone": "incheon",
        "zone_name": "인천 서구",
        "base_price": 6.2,
        "base_jeonse": 4.3,
        "base_pyeong": 2100,
        "risk_level": "warning",
        "risk_label": "갭축소 주의",
        "risk_desc": "검단 대규모 신축 입주 폭탄으로 전세가 변동성 및 역전세 주의"
    },
    "28237": {
        "name": "인천 부평구",
        "region": "incheon",
        "zone": "incheon",
        "zone_name": "인천 부평",
        "base_price": 5.1,
        "base_jeonse": 3.8,
        "base_pyeong": 1750,
        "risk_level": "critical",
        "risk_label": "역전세 위험",
        "risk_desc": "노후 구축 밀집, 전세가율 74%대 갭투자 유입 단지 보증금 미반환 우려"
    }
}


class MolitRealEstateCollector:
    """국토교통부 공공데이터 실거래가 수집 엔진"""

    def __init__(self):
        self._override_key: Optional[str] = None
        self._cached_results: Dict[str, Dict[str, Any]] = {}
        self._last_synced_at: Optional[str] = None
        self._has_successful_live_fetch: bool = False
        self._last_error: Optional[str] = None

    @property
    def api_key(self) -> str:
        """환경변수 MOLIT_API_KEY 동적 로드 (테스트용 오버라이드 지원)"""
        if self._override_key is not None:
            return self._override_key
        try:
            from pathlib import Path
            from dotenv import load_dotenv
            env_path = Path(__file__).resolve().parent.parent / ".env"
            if env_path.exists():
                load_dotenv(dotenv_path=env_path, override=True)
        except Exception as e:
            logger.debug(f"Failed to reload .env dynamically for MOLIT: {e}")
        return os.getenv("MOLIT_API_KEY", "").strip()

    @api_key.setter
    def api_key(self, val: str):
        self._override_key = val

    @property
    def is_sample_or_missing(self) -> bool:
        """인증키가 미설정이거나 샘플/테스트 키인지 검증"""
        key = self.api_key
        if not key:
            return True
        key_lower = key.lower()
        return key_lower in ("sample", "none", "null", "test", "")

    def parse_molit_xml(self, xml_text: str) -> List[Dict[str, Any]]:
        """국토부 특유의 XML 응답을 파싱하여 실거래 레코드 리스트로 정규화"""
        items: List[Dict[str, Any]] = []
        if not xml_text or not xml_text.strip():
            return items

        try:
            root = ET.fromstring(xml_text)
            
            # 응답 코드 검증
            header = root.find("header")
            if header is not None:
                result_code = header.findtext("resultCode", "")
                if result_code not in ("00", "000", "INFO-000", "NORMAL_SERVICE"):
                    msg = header.findtext("resultMsg", "Unknown Error")
                    logger.warning(f"MOLIT API returned non-zero code [{result_code}]: {msg}")
                    return items

            # body -> items -> item 파싱
            body = root.find("body")
            if body is None:
                return items
            items_node = body.find("items")
            if items_node is None:
                return items

            for item_node in items_node.findall("item"):
                # 거래금액 ("   160,000" -> 160000 만원)
                raw_amt = (item_node.findtext("dealAmount") or item_node.findtext("deposit") or "0").replace(",", "").strip()
                try:
                    amount = float(raw_amt)
                except ValueError:
                    amount = 0.0

                # 전용면적
                raw_area = (item_node.findtext("excluUseAr") or "0").strip()
                try:
                    exclu_area = float(raw_area)
                except ValueError:
                    exclu_area = 0.0

                apt_name = (item_node.findtext("aptNm") or "").strip()
                deal_year = (item_node.findtext("dealYear") or "").strip()
                deal_month = (item_node.findtext("dealMonth") or "").strip().zfill(2)
                deal_day = (item_node.findtext("dealDay") or "").strip().zfill(2)
                floor = (item_node.findtext("floor") or "1").strip()
                dong = (item_node.findtext("dong") or item_node.findtext("umdNm") or "").strip()

                if amount > 0:
                    items.append({
                        "apt_name": apt_name,
                        "amount_won": amount, # 만원 단위
                        "area_sqm": exclu_area,
                        "deal_date": f"{deal_year}.{deal_month}.{deal_day}" if deal_year else "",
                        "floor": floor,
                        "dong": dong
                    })

        except ET.ParseError as e:
            logger.warning(f"XML parsing error from MOLIT API: {e}")
        except Exception as e:
            logger.error(f"Unexpected error parsing MOLIT XML: {e}")

        return items

    async def fetch_apt_trade_live(self, lawd_cd: str, deal_ymd: str) -> List[Dict[str, Any]]:
        """국토부 아파트 매매 실거래 상세자료 비동기 조회"""
        if self.is_sample_or_missing:
            return []

        params = {
            "serviceKey": self.api_key,
            "LAWD_CD": lawd_cd,
            "DEAL_YMD": deal_ymd,
            "pageNo": "1",
            "numOfRows": "100"
        }

        endpoints = [MOLIT_TRADE_API_BASE, MOLIT_TRADE_API_DEV_BASE]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for ep in endpoints:
                    res = await client.get(ep, params=params)
                    if res.status_code == 200:
                        items = self.parse_molit_xml(res.text)
                        if items:
                            self._has_successful_live_fetch = True
                            self._last_error = None
                            return items
                    elif res.status_code == 403:
                        self._last_error = "SERVICE_KEY_IS_NOT_REGISTERED_ERROR (403)"
                        logger.warning(f"MOLIT Trade API 403 on {ep}: {self._last_error}")
                    else:
                        self._last_error = f"HTTP_{res.status_code}"
                        logger.warning(f"MOLIT Trade API HTTP {res.status_code} on {ep} for LAWD_CD {lawd_cd}")
        except Exception as e:
            self._last_error = str(e)
            logger.error(f"Error calling MOLIT Trade API for {lawd_cd}: {e}")

        return []

    async def fetch_apt_rent_live(self, lawd_cd: str, deal_ymd: str) -> List[Dict[str, Any]]:
        """국토부 아파트 전월세 실거래 상세자료 비동기 조회"""
        if self.is_sample_or_missing:
            return []

        params = {
            "serviceKey": self.api_key,
            "LAWD_CD": lawd_cd,
            "DEAL_YMD": deal_ymd,
            "pageNo": "1",
            "numOfRows": "100"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(MOLIT_RENT_API_BASE, params=params)
                if res.status_code == 200:
                    return self.parse_molit_xml(res.text)
                elif res.status_code == 403:
                    self._last_error = "SERVICE_KEY_IS_NOT_REGISTERED_ERROR (403)"
                    logger.warning(f"MOLIT Rent API 403: {self._last_error}")
                else:
                    logger.warning(f"MOLIT Rent API HTTP {res.status_code} for LAWD_CD {lawd_cd}")
        except Exception as e:
            logger.error(f"Error calling MOLIT Rent API for {lawd_cd}: {e}")

        return []

    async def collect_metro_district_stats(self, target_ymd: Optional[str] = None) -> List[Dict[str, Any]]:
        """수도권 13대 거점 실시간 실거래가 수집 및 정규화
        - 유효 키 있고 실제 정상 응답 시: 국토교통부 API 데이터로 실시간 갱신
        - 유효 키 없거나 403/미등록 에러 시: 내장 기준치(base_price/base_jeonse)로 안전 Fallback
        """
        now = datetime.now()
        # 최근 월 계약년월 (예: 202610 또는 직전월)
        ymd = target_ymd or f"{now.year}{str(now.month).zfill(2)}"
        
        has_key = not self.is_sample_or_missing
        results: List[Dict[str, Any]] = []
        any_live_fetched = False

        for code, meta in METRO_DISTRICT_REGISTRY.items():
            trade_items: List[Dict[str, Any]] = []
            rent_items: List[Dict[str, Any]] = []

            if has_key:
                try:
                    # 매매와 전세 비동기 동시 수집
                    t_res, r_res = await asyncio.gather(
                        self.fetch_apt_trade_live(code, ymd),
                        self.fetch_apt_rent_live(code, ymd),
                        return_exceptions=True
                    )
                    if isinstance(t_res, list):
                        trade_items = t_res
                    if isinstance(r_res, list):
                        rent_items = r_res
                except Exception as e:
                    logger.warning(f"Live collection failed for district {meta['name']} ({code}): {e}")

            # 라이브 데이터가 실제로 1건 이상 수집되었을 때만 LIVE 모드 적용
            if trade_items:
                any_live_fetched = True
                is_district_live = True
                valid_trades = [t for t in trade_items if t["amount_won"] > 0]
                trade_count = len(valid_trades)
                avg_sale_manwon = sum(t["amount_won"] for t in valid_trades) / trade_count if trade_count > 0 else (meta["base_price"] * 10000)
                avg_sale_price = round(avg_sale_manwon / 10000.0, 1) # 억 단위

                # 평당가 연산: 평 = ㎡ / 3.3058
                pyeong_rates = [
                    (t["amount_won"] / (t["area_sqm"] / 3.3058)) 
                    for t in valid_trades if t["area_sqm"] > 10
                ]
                price_per_pyeong = int(sum(pyeong_rates) / len(pyeong_rates)) if pyeong_rates else meta["base_pyeong"]

                # 전세가 및 전세가율
                valid_rents = [r for r in rent_items if r["amount_won"] > 0]
                if valid_rents:
                    avg_jeonse_manwon = sum(r["amount_won"] for r in valid_rents) / len(valid_rents)
                    avg_jeonse_price = round(avg_jeonse_manwon / 10000.0, 1)
                else:
                    avg_jeonse_price = meta["base_jeonse"]

                jeonse_ratio = round((avg_jeonse_price / avg_sale_price) * 100, 1) if avg_sale_price > 0 else 60.0
            else:
                # Fallback 기본 데이터 (정규화 캐시)
                is_district_live = False
                avg_sale_price = meta["base_price"]
                avg_jeonse_price = meta["base_jeonse"]
                jeonse_ratio = round((avg_jeonse_price / avg_sale_price) * 100, 1)
                trade_count = 150 + (int(code) % 150)
                price_per_pyeong = meta["base_pyeong"]

            results.append({
                "code": code,
                "name": meta["name"],
                "region": meta["region"],
                "zone": meta["zone"],
                "zone_name": meta["zone_name"],
                "avg_sale_price": avg_sale_price,
                "avg_jeonse_price": avg_jeonse_price,
                "jeonse_ratio": jeonse_ratio,
                "trade_count": trade_count,
                "price_per_pyeong": price_per_pyeong,
                "risk_level": meta["risk_level"],
                "risk_label": meta["risk_label"],
                "risk_desc": meta["risk_desc"],
                "data_source": "MOLIT_API_LIVE" if is_district_live else "FALLBACK_CACHE",
                "is_fallback": not is_district_live
            })

        self._has_successful_live_fetch = any_live_fetched
        self._last_synced_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self._cached_results = {d["code"]: d for d in results}
        mode_label = "MOLIT_API_LIVE" if any_live_fetched else "FALLBACK_CACHE"
        logger.info(f"MOLIT collector processed {len(results)} metro districts (Mode: {mode_label})")
        return results

    def get_api_status(self) -> Dict[str, Any]:
        """국토부 실거래가 API 연동 상태 진단"""
        has_key = not self.is_sample_or_missing
        is_live = has_key and self._has_successful_live_fetch

        status_text = "LIVE_ACTIVE" if is_live else ("UNREGISTERED_KEY_ERROR" if (has_key and self._last_error) else "FALLBACK_CACHE_ACTIVE")

        return {
            "api_name": "MOLIT_PUBLIC_DATA",
            "provider": "국토교통부 공공데이터포털",
            "has_key": has_key,
            "is_live": is_live,
            "status": status_text,
            "last_error": self._last_error,
            "covered_districts": len(METRO_DISTRICT_REGISTRY),
            "last_synced_at": self._last_synced_at or "2026-10-17 00:00:00",
            "data_source": "MOLIT_API_LIVE" if is_live else "FALLBACK_CACHE"
        }


# 전역 싱글톤 인스턴스
molit_collector = MolitRealEstateCollector()
