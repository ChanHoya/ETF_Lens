# 브라질 국채 관련 뉴스를 Google News RSS로 수집·저장하고 신규 항목을 감지하는 모듈
"""
무인증·무료인 Google News RSS(한국어)로 '브라질 국채/헤알/금리' 관련 뉴스를 수집한다.
link 유니크로 upsert 하며, 이전에 없던(신규) 항목을 반환해 텔레그램 알림에 활용한다.
"""

import asyncio
import html
import re
from datetime import timezone, timedelta
from email.utils import parsedate_to_datetime

import httpx
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import BrazilNews

_KST = timezone(timedelta(hours=9))

# 한국어 브라질 국채 관련 검색어 (OR 결합)
_QUERY = "브라질 국채 OR 헤알 OR 브라질 금리 OR 브라질 Selic"


def _parse_rss(xml_text: str) -> list[dict]:
    """RSS 텍스트에서 뉴스 항목 파싱. 표준 라이브러리 xml 사용."""
    import xml.etree.ElementTree as ET
    items = []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return items
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pub = (it.findtext("pubDate") or "").strip()
        src_el = it.find("source")
        source = (src_el.text.strip() if src_el is not None and src_el.text else "")
        if not title or not link:
            continue
        # 제목 형식 "제목 - 언론사" → 언론사 분리 보정
        if not source and " - " in title:
            source = title.rsplit(" - ", 1)[-1].strip()
        clean_title = html.unescape(re.sub(r"\s+-\s+[^-]+$", "", title)).strip() if " - " in title else html.unescape(title)
        ts = None
        pub_kst = pub
        try:
            dt = parsedate_to_datetime(pub)
            ts = int(dt.timestamp())
            pub_kst = dt.astimezone(_KST).strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass
        items.append({
            "title": clean_title, "link": link, "source": source,
            "published": pub_kst, "published_ts": ts,
        })
    return items


async def fetch_brazil_news(limit: int = 25) -> list[dict]:
    """Google News RSS 에서 최신 뉴스 파싱(발행일 내림차순). 실패 시 빈 리스트."""
    from urllib.parse import quote
    url = f"https://news.google.com/rss/search?q={quote(_QUERY)}&hl=ko&gl=KR&ceid=KR:ko"
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            r = await client.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            items = _parse_rss(r.text)
    except Exception as e:
        print(f"[brazil_news] fetch failed: {e}")
        return []
    items.sort(key=lambda x: x["published_ts"] or 0, reverse=True)
    return items[:limit]


async def sync_brazil_news(alert_new: bool = False) -> dict:
    """뉴스 수집→upsert. 신규 항목 리스트와 최초 시딩 여부를 반환.
    반환: {'stored': n, 'new_items': [...], 'was_empty': bool}"""
    items = await fetch_brazil_news()
    if not items:
        return {"stored": 0, "new_items": [], "was_empty": False}

    async with AsyncSessionLocal() as db:
        existing_links = set(
            (await db.execute(select(BrazilNews.link))).scalars().all()
        )
        was_empty = len(existing_links) == 0
        new_items = []
        for it in items:
            if it["link"] in existing_links:
                continue
            # 최초 시딩(테이블 비어있던 경우)은 알림 대상에서 제외(notified=1로 저장)
            notified = 1 if (was_empty or not alert_new) else 0
            db.add(BrazilNews(
                link=it["link"], title=it["title"], source=it["source"],
                published=it["published"], published_ts=it["published_ts"], notified=notified,
            ))
            if not was_empty and alert_new:
                new_items.append(it)
        await db.commit()
    return {"stored": len(items), "new_items": new_items, "was_empty": was_empty}


async def get_recent_news(limit: int = 12) -> list[dict]:
    """저장된 뉴스 최신순 반환(프론트 피드용)."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(BrazilNews.title, BrazilNews.source, BrazilNews.link, BrazilNews.published, BrazilNews.published_ts)
            .order_by(BrazilNews.published_ts.desc().nullslast())
            .limit(limit)
        )).all()
    return [{"title": t, "source": s, "link": l, "published": p} for t, s, l, p, _ in rows]


async def mark_notified(links: list[str]):
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(BrazilNews).where(BrazilNews.link.in_(links)))).scalars().all()
        for r in rows:
            r.notified = 1
        await db.commit()


if __name__ == "__main__":
    print(asyncio.run(sync_brazil_news()))
