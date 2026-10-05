import asyncio
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import pytz
from agents.harvester.harvester import ETFHarvester
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import ETFMaster, ETFDailyPrice, ETFHoldings, BenchmarkPrice, AppVersion

# KST 기준으로 cron job 실행 (UTC 사용 시 hour=7이 KST 16시가 됨)
scheduler = AsyncIOScheduler(timezone=pytz.timezone('Asia/Seoul'))


async def update_app_version(job_label: str = "") -> None:
    """
    스케줄러 job 완료 시 AppVersion 테이블에 KST yymmddhhmm 버전을 저장.
    job_label: 어떤 job이 마지막으로 실행됐는지 표시 (예: '[master]', '[perf]')
    """
    from datetime import timezone, timedelta as _td
    _kst = timezone(_td(hours=9))
    kst_now = datetime.now(_kst)
    version_str = kst_now.strftime("VER %y%m%d%H%M")
    if job_label:
        version_str += f" {job_label}"
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AppVersion).where(AppVersion.key == "app_version"))
            rec = result.scalars().first()
            if rec:
                rec.value = version_str
                rec.updated_at = kst_now.replace(tzinfo=None)
            else:
                db.add(AppVersion(key="app_version", value=version_str))
            await db.commit()
        print(f"[AppVersion] 업데이트: {version_str}")
    except Exception as e:
        print(f"[AppVersion] 업데이트 실패: {e}")


async def sync_etf_master_list():
    """
    KRX ETF 전체 코드+이름+운용사 목록을 ETFMaster에 upsert합니다.
    1순위: Naver ETF 리스트 API (매우 가볍고 0.1초 이내 완료, OOM 차단)
    2순위: FinanceDataReader StockListing
    + manual_inclusions: 당일 신규 상장 종목 (API 반영 지연 우회)
    """
    print(f"[{datetime.now()}] [ETF Master Sync] Starting KRX ETF list sync...")
    rows: list[dict] = []

    def get_issuer_from_name(name: str) -> str:
        name_upper = name.upper()
        for brand, issuer in [
            ("KODEX", "삼성자산운용"),
            ("TIGER", "미래에셋자산운용"),
            ("KBSTAR", "KB자산운용"),
            ("ACE", "한국투자신탁운용"),
            ("SOL", "신한자산운용"),
            ("HANARO", "NH-Amundi자산운용"),
            ("KOSEF", "키움투자자산운용"),
            ("PLUS", "한화자산운용"),
            ("ARIRANG", "한화자산운용"),
            ("WOORI", "우리자산운용"),
            ("HI", "하이자산운용"),
            ("FOCUS", "브레인자산운용"),
            ("UNIS", "유니에스자산운용"),
            ("TREX", "유리자산운용"),
            ("MIGHTY", "에이치디씨자산운용"),
            ("KAP", "한국자산평가"),
        ]:
            if brand in name_upper:
                return issuer
        return ""

    # --- 1순위: Naver ETF 리스트 API ---
    try:
        import urllib.request, json, ssl
        ctx = ssl._create_unverified_context()
        url = "https://finance.naver.com/api/sise/etfItemList.nhn"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = await asyncio.to_thread(
            lambda: urllib.request.urlopen(req, timeout=10, context=ctx).read()
        )
        try:
            text = res.decode("utf-8")
        except UnicodeDecodeError:
            text = res.decode("cp949")
            
        data = json.loads(text)
        items = data.get("result", {}).get("etfItemList", [])
        for item in items:
            code = str(item.get("itemcode", "")).strip().zfill(6)
            name = str(item.get("itemname", "")).strip()
            if code and name and len(code) == 6:
                rows.append({"code": code, "name": name, "issuer": get_issuer_from_name(name)})
        print(f"[ETF Master Sync] Naver API: {len(rows)} ETFs loaded")
    except Exception as e:
        print(f"[ETF Master Sync] Naver API failed: {e}")

    # --- 2순위: FinanceDataReader fallback ---
    if not rows:
        try:
            import FinanceDataReader as fdr  # type: ignore
            df = await asyncio.to_thread(fdr.StockListing, "ETF/KR")
            for _, row in df.iterrows():
                code = str(row.get("Symbol", row.get("Code", ""))).strip().zfill(6)
                name = str(row.get("Name", "")).strip()
                if code and name and len(code) == 6:
                    rows.append({"code": code, "name": name, "issuer": get_issuer_from_name(name)})
            print(f"[ETF Master Sync] fdr fallback: {len(rows)} ETFs loaded")
        except Exception as e:
            print(f"[ETF Master Sync] fdr fallback failed: {e}")

    # === 강제 추가: 신규 상장 종목 ===
    manual_inclusions = [
        {"code": "0180V0", "name": "ACE 미국우주테크액티브", "issuer": "ACE"},
        {"code": "0183J0", "name": "TIGER 미국우주테크", "issuer": "TIGER"},
    ]
    for m in manual_inclusions:
        if not any(r["code"] == m["code"] for r in rows):
            rows.append(m)
            print(f"[ETF Master Sync] Manual inclusion: {m['code']} {m['name']}")

    if not rows:
        print("[ETF Master Sync] No ETF data retrieved. Skipping DB update.")
        return

    # --- DB Bulk Upsert (단 1회의 데이터베이스 쿼리로 성능 극대화) ---
    async with AsyncSessionLocal() as db:
        try:
            existing_res = await db.execute(select(ETFMaster))
            existing_masters = {m.code: m for m in existing_res.scalars().all()}
            
            upserted = 0
            for item in rows:
                code = item["code"]
                master = existing_masters.get(code)
                if not master:
                    master = ETFMaster(code=code)
                    db.add(master)
                master.name = item["name"]
                if item.get("issuer"):
                    master.issuer = item["issuer"]
                upserted += 1
                
            await db.commit()
            print(f"[{datetime.now()}] [ETF Master Sync] Done. {upserted} ETFs bulk-upserted.")
        except Exception as e:
            print(f"[ETF Master Sync] bulk upsert error: {e}")
            await db.rollback()


async def sync_etf_batch():
    print(f"[{datetime.now()}] Starting massive ETF DB sync batch...")
    harvester = ETFHarvester()
    await harvester.initialize()
    if harvester.etf_list is None or harvester.etf_list.empty:
        print("Failed to load ETF list.")
        return

    # 메모리 절감: 동시 처리 수 10→3 (Starter 512MB 기준)
    sem = asyncio.Semaphore(3)

    async def process_code(code: str, name: str, issuer: str):
        async with sem:
            try:
                from sqlalchemy import func
                from datetime import timedelta

                # Check if we already have history for this ETF to determine full vs incremental fetch
                existing_count = 0
                async with AsyncSessionLocal() as db:
                    res_count = await db.execute(
                        select(func.count(ETFDailyPrice.id)).where(ETFDailyPrice.code == code)
                    )
                    existing_count = res_count.scalar() or 0

                # If we have less than 200 rows, do a full fetch (10 years)
                # Otherwise, do an incremental fetch (1 year, from which we only insert the last 30 days)
                skip_chart = existing_count >= 200

                # Fetch fresh data skipping cache
                data = await harvester.fetch_naver_etf_data(
                    code, skip_holdings=False, skip_chart=skip_chart
                )

                async with AsyncSessionLocal() as db:
                    # 1. Upsert Master
                    result = await db.execute(
                        select(ETFMaster).where(ETFMaster.code == code)
                    )
                    master = result.scalars().first()
                    if not master:
                        master = ETFMaster(code=code)
                        db.add(master)

                    master.name = name
                    master.issuer = issuer
                    master.nav = data.get("market_data", {}).get("nav")
                    master.price = data.get("market_data", {}).get("price")
                    b_info = data.get("basic_info", {})
                    master.basic_info_json = json.dumps(b_info, ensure_ascii=False)

                    if "펀드보수" in b_info:
                        import re

                        fee_nums = re.findall(r"[\d\.]+", str(b_info["펀드보수"]))
                        if fee_nums:
                            master.tot_fee = float(fee_nums[0])
                    master.aum = b_info.get("순자산총액")

                    # 2. Upsert Daily Prices (Incremental update strategy to save memory)
                    # We delete existing holdings and replace them (holdings are small)
                    await db.execute(
                        ETFHoldings.__table__.delete().where(ETFHoldings.code == code)
                    )

                    prices = data.get("historical_data", {}).get("prices", [])
                    dates = data.get("historical_data", {}).get("dates", [])

                    if skip_chart:
                        # Incremental update: Only delete and insert the last 30 days
                        cutoff_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
                        await db.execute(
                            ETFDailyPrice.__table__.delete().where(
                                (ETFDailyPrice.code == code) & (ETFDailyPrice.date >= cutoff_date)
                            )
                        )
                        price_objs = [
                            ETFDailyPrice(code=code, date=d, close=p)
                            for d, p in zip(dates, prices)
                            if d >= cutoff_date
                        ]
                    else:
                        # Full load: Delete all old prices and insert full history
                        await db.execute(
                            ETFDailyPrice.__table__.delete().where(
                                ETFDailyPrice.code == code
                            )
                        )
                        price_objs = [
                            ETFDailyPrice(code=code, date=d, close=p)
                            for d, p in zip(dates, prices)
                        ]

                    db.add_all(price_objs)

                    # 3. Upsert Holdings
                    holdings_data = data.get("holdings", [])
                    holding_objs = [
                        ETFHoldings(
                            code=code,
                            ticker=h["ticker"],
                            weight=h["weight"],
                            shares=h.get("shares"),
                        )
                        for h in holdings_data
                    ]
                    db.add_all(holding_objs)

                    await db.commit()
            except Exception as e:
                print(f"Error processing DB sync for {code}: {e}")

    from core.active_etfs import get_active_etf_codes
    active_codes = await get_active_etf_codes()
    print(f"[sync_etf_batch] Active codes to sync: {len(active_codes)} - {active_codes}")

    filtered_list = harvester.etf_list[harvester.etf_list["Symbol"].isin(active_codes)]
    codes_to_sync = filtered_list[["Symbol", "Name"]].to_dict("records")
    
    tasks = [process_code(c["Symbol"], c["Name"], "Unknown") for c in codes_to_sync]
    await asyncio.gather(*tasks)

    # Sync benchmarks
    try:
        from api.router import cached_fdr_reader, fetch_yahoo_finance
        from datetime import timedelta
        from sqlalchemy import func

        async with AsyncSessionLocal() as db:
            res_bench = await db.execute(
                select(func.count(BenchmarkPrice.id))
            )
            existing_bench_count = res_bench.scalar() or 0

        # If empty/low, load 10 years; otherwise load last 30 days to save memory
        load_days = 3650 if existing_bench_count < 200 else 30
        start_str = (datetime.now() - timedelta(days=load_days)).strftime("%Y-%m-%d")

        async with AsyncSessionLocal() as db:
            if load_days == 3650:
                await db.execute(BenchmarkPrice.__table__.delete())
            else:
                cutoff_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
                await db.execute(
                    BenchmarkPrice.__table__.delete().where(BenchmarkPrice.date >= cutoff_date)
                )

            benchmarks = {
                "KS11": await cached_fdr_reader("KS11", start_str),
                "KQ11": await cached_fdr_reader("KQ11", start_str),
                "^GSPC": await fetch_yahoo_finance("^GSPC", 1 if load_days == 30 else 10),
                "^IXIC": await fetch_yahoo_finance("^IXIC", 1 if load_days == 30 else 10),
            }

            for symbol, df in benchmarks.items():
                if not df.empty:
                    price_objs = []
                    cutoff_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
                    for dt_ts, row in df.iterrows():
                        dt_str = str(dt_ts.date())
                        if load_days == 30 and dt_str < cutoff_date:
                            continue
                        price_objs.append(
                            BenchmarkPrice(
                                symbol=symbol, date=dt_str, close=row["Close"]
                              )
                        )
                    db.add_all(price_objs)

            await db.commit()
    except Exception as e:
        print(f"Error syncing benchmarks: {e}")

    await harvester.close()
    print(f"[{datetime.now()}] ETF DB sync completed.")


async def check_exit_signal_and_alert() -> None:
    """
    exit-signal 데이터를 집계하여 이전 등급/점수와 비교한 후,
    변경 사항이 있거나 '경계'/'위험' 단계 진입 시 텔레그램 알림을 발송합니다.
    """
    from api.exit_signal import get_exit_signal_data
    from core.notifier import send_telegram_message
    from db.models import AppVersion
    
    print("[ExitSignalAlert] Checking exit-signals and computing risk level...")
    try:
        # 1. Fetch current exit signal status
        data = await get_exit_signal_data()
        risk = data.get("risk", {})
        curr_level = risk.get("level", "safe")
        curr_label = risk.get("label", "안전")
        curr_color = risk.get("color", "green")
        curr_score = risk.get("score", 0)
        
        # 2. Get last saved state from DB
        prev_level = None
        prev_score = None
        
        async with AsyncSessionLocal() as db:
            lvl_res = await db.execute(select(AppVersion).where(AppVersion.key == "last_exit_risk_level"))
            lvl_rec = lvl_res.scalars().first()
            if lvl_rec:
                prev_level = lvl_rec.value
            else:
                db.add(AppVersion(key="last_exit_risk_level", value=curr_level))
                
            scr_res = await db.execute(select(AppVersion).where(AppVersion.key == "last_exit_risk_score"))
            scr_rec = scr_res.scalars().first()
            if scr_rec:
                try:
                    prev_score = int(scr_rec.value)
                except ValueError:
                    prev_score = 0
            else:
                db.add(AppVersion(key="last_exit_risk_score", value=str(curr_score)))
                
            await db.commit()
            
        print(f"[ExitSignalAlert] Current: {curr_label} ({curr_score}점) | Previous: {prev_level} ({prev_score}점)")
        
        # 3. Check transition / alerting conditions:
        # - Level changed (e.g. caution -> warning)
        # - Or Score changed by 2+ points
        # - Or first-time run (prev_level was None)
        is_changed = (prev_level is not None and prev_level != curr_level)
        is_score_jump = (prev_score is not None and abs(curr_score - prev_score) >= 2)
        is_first_run = (prev_level is None)
        
        if is_changed or is_score_jump or is_first_run:
            # Update DB with new values
            async with AsyncSessionLocal() as db:
                lvl_res = await db.execute(select(AppVersion).where(AppVersion.key == "last_exit_risk_level"))
                lvl_rec = lvl_res.scalars().first()
                if lvl_rec:
                    lvl_rec.value = curr_level
                
                scr_res = await db.execute(select(AppVersion).where(AppVersion.key == "last_exit_risk_score"))
                scr_rec = scr_res.scalars().first()
                if scr_rec:
                    scr_rec.value = str(curr_score)
                await db.commit()
                
            # Compile Indicators Breakdown
            cs = data.get("current_status", {})
            vix_val = cs.get("vix", 0)
            vkospi_val = cs.get("vkospi_proxy", 15.0)
            fgi_val = cs.get("fgi", 50)
            cli_val = cs.get("cli", 100)
            per_val = cs.get("per", 12)
            t10y2y_val = cs.get("t10y2y", 1.0)
            hy_val = cs.get("hy_spread", 3.0)
            
            breakdown = risk.get("breakdown", {})
            vix_score = breakdown.get("vix", {}).get("score", 0)
            vkospi_score = breakdown.get("vkospi_proxy", {}).get("score", 0)
            fgi_score = breakdown.get("fgi", {}).get("score", 0)
            cli_score = breakdown.get("cli", {}).get("score", 0)
            per_score = breakdown.get("per", {}).get("score", 0)
            t10y2y_score = breakdown.get("t10y2y", {}).get("score", 0)
            hy_score = breakdown.get("hy_spread", {}).get("score", 0)
            
            def _score_label(score):
                m = {0: "안전", 1: "주의", 2: "경계", 3: "위험"}
                return m.get(score, "안전")
            
            def _per_label(score):
                m = {0: "저평가", 1: "적정", 2: "경계", 3: "고평가"}
                return m.get(score, "적정")
            
            # Choose header emoji based on risk level
            emoji_map = {"safe": "🟢", "caution": "🟡", "warning": "🟠", "danger": "🔴"}
            emoji = emoji_map.get(curr_level, "⚠️")
            
            # Compile nice rich text HTML
            header = f"{emoji} <b>[시장 위험도(Exit Signal) 변동 알림]</b>\n\n"
            if is_first_run:
                transition = f"시장 종합 위험도 모니터링이 시작되었습니다.\n현재 상태: <b>{curr_label} ({curr_score}/21점)</b>\n"
            else:
                def _get_label_by_level(lvl):
                    m = {"safe": "안전", "caution": "주의", "warning": "경계", "danger": "위험"}
                    return m.get(lvl, lvl)
                transition = f"위험도 등급 변화: <b>{_get_label_by_level(prev_level)} ({prev_score}점)</b> ➡️ <b>{curr_label} ({curr_score}점)</b>\n"
                
            body = (
                f"\n📊 <b>주요 매크로 지표 현황:</b>\n"
                f"- <b>VIX 미국 공포지수:</b> <code>{vix_val:.1f}</code> ({_score_label(vix_score)})\n"
                f"- <b>VKOSPI 국내 변동성(Proxy):</b> <code>{vkospi_val:.1f}%</code> ({_score_label(vkospi_score)})\n"
                f"- <b>하이브리드 FGI 지수:</b> <code>{fgi_val:.1f}</code> ({_score_label(fgi_score)})\n"
                f"- <b>경기선행지수(CLI):</b> <code>{cli_val:.2f}</code> ({_score_label(cli_score)})\n"
                f"- <b>KOSPI PER:</b> <code>{per_val:.1f}</code> ({_per_label(per_score)})\n"
                f"- <b>미 장단기 금리차 (10Y-2Y):</b> <code>{t10y2y_val:.2f}%</code> ({_score_label(t10y2y_score)})\n"
                f"- <b>미 하이일드 스프레드:</b> <code>{hy_val:.2f}%</code> ({_score_label(hy_score)})\n"
                f"\n💡 <i>대시보드(<a href='https://etf-lens.vercel.app'>etf-lens.vercel.app</a>)에서 AI 포트폴리오 자산 추천 및 가상 체결 리밸런싱을 즉시 진행할 수 있습니다.</i>"
            )
            
            success, _ = await send_telegram_message(header + transition + body, category="exit_signal")
            print("[ExitSignalAlert] Telegram notification dispatched successfully.")
            
    except Exception as e:
        print(f"[ExitSignalAlert] Failed to run exit signal check and notification: {e}")


_disparity_alert_cache = {}  # dict[str, float] -> code: last_alerted_timestamp


async def check_etf_disparity_and_alert() -> None:
    """
    모니터링 대상 ETF의 실시간 괴리율을 체크하고,
    사용자별 개인화 괴리율 임계치를 초과한 경우 멀티채널(Telegram, Discord, Slack) 알림을 전송합니다.
    (동일 종목 1시간 쿨다운 적용)
    """
    import time
    from core.disparity_analyzer import fetch_etf_disparity_list
    from core.notifier import broadcast_notification, get_all_notification_settings
    from api.my_assets import get_my_portfolio
    from db.database import AsyncSessionLocal
    import pytz
    
    print("[DisparityAlert] Checking ETF disparity rates with personalized thresholds...")
    
    # 0. 사용자 알림 설정 확인 (알림 활성화 여부 및 최소 임계치 산출)
    all_settings = await get_all_notification_settings()
    active_settings = [s for s in all_settings if getattr(s, "alert_disparity", 1) == 1]
    
    # 활성화된 설정의 임계치 중 최소값 적용 (기본 2.0%)
    thresholds = [getattr(s, "disparity_threshold", 2.0) or 2.0 for s in active_settings]
    min_threshold = min(thresholds) if thresholds else 2.0
    check_all_scope = any(getattr(s, "disparity_target_scope", "PORTFOLIO") == "ALL" for s in active_settings)

    # 1. 모니터링 대상 ETF 코드 모으기
    # 기본 모니터링 대상 (우주 & 바이오 핵심 ETF)
    monitored_codes = {
        "0167Z0": "KODEX 미국우주항공",
        "0180V0": "ACE 미국우주테크액티브",
        "0183J0": "TIGER 미국우주테크",
        "0181L0": "SOL 미국우주항공TOP10",
        "462900": "KoAct 바이오헬스케어액티브",
        "463050": "TIME K바이오액티브",
        "244580": "KODEX 바이오",
        "143860": "TIGER 헬스케어",
        "364970": "TIGER 바이오TOP10"
    }
    
    # 보유 종목 추가
    try:
        async with AsyncSessionLocal() as db:
            portfolio = await get_my_portfolio(request=None, db=db)
            holdings = portfolio.get("kis_raw", {}).get("holdings", [])
            for h in holdings:
                code = h.get("code")
                name = h.get("name")
                if code and len(code) == 6 and code.isdigit():
                    monitored_codes[code] = name
    except Exception as e:
        print(f"[DisparityAlert] Failed to fetch portfolio holdings: {e}")
        
    # 2. 실시간 괴리율 전체 목록 가져오기
    try:
        disparity_map = await fetch_etf_disparity_list()
    except Exception as e:
        print(f"[DisparityAlert] Failed to fetch disparity list: {e}")
        return
        
    # 3. 대상 종목 판별 (PORTFOLIO vs ALL)
    target_items = {}
    if check_all_scope:
        for code, info in disparity_map.items():
            target_items[code] = info.get("name", code)
    else:
        target_items = monitored_codes

    now_ts = time.time()
    COOLDOWN_SECONDS = 3600  # 1시간 쿨다운

    # 4. 임계치 초과 종목 판별 (|disparity_rate| >= min_threshold) 및 쿨다운 필터
    alert_items = []
    for code, name in target_items.items():
        etf_info = disparity_map.get(code)
        if not etf_info:
            continue
        
        disparity_rate = etf_info.get("disparity_rate", 0.0)
        if abs(disparity_rate) >= min_threshold:
            # 쿨다운 체크
            last_alert = _disparity_alert_cache.get(code, 0)
            if now_ts - last_alert < COOLDOWN_SECONDS:
                continue
            
            alert_items.append({
                "code": code,
                "name": etf_info.get("name") or name,
                "price": etf_info.get("price"),
                "nav": etf_info.get("nav"),
                "disparity_rate": disparity_rate
            })
            
    if not alert_items:
        print(f"[DisparityAlert] No ETFs exceeded disparity threshold (>= {min_threshold}% or in cooldown).")
        return

    # 쿨다운 갱신
    for item in alert_items:
        _disparity_alert_cache[item["code"]] = now_ts
        
    # 5. 메시지 생성 및 멀티채널 발송
    now_kst = datetime.now(pytz.timezone('Asia/Seoul'))
    time_str = now_kst.strftime("%Y-%m-%d %H:%M")
    
    is_open = now_kst.hour == 9
    timing_label = "장초반 (09:10)" if is_open else "장중 실시간"
    
    header = f"🚨 <b>[ETF 실시간 괴리율 경보 - {timing_label}]</b>\n"
    header += f"조회 시점: {time_str} KST\n\n"
    header += f"설정 임계치(±{min_threshold:.1f}%)를 초과한 종목이 감지되었습니다. 매매 시 주의하시기 바랍니다.\n\n"
    
    body = ""
    for item in alert_items:
        rate = item["disparity_rate"]
        status_badge = f"🔴 <b>할인 (Discount {rate:.2f}%)</b>" if rate < 0 else f"🔵 <b>할증 (Premium +{rate:.2f}%)</b>"
        price_val = item.get("price")
        nav_val = item.get("nav")
        price_str = f"{int(price_val):,}원" if price_val else "N/A"
        nav_str = f"{int(nav_val):,}원" if nav_val else "N/A"
        body += (
            f"▪️ <b>{item['name']}</b> ({item['code']})\n"
            f"  - 현재가: <code>{price_str}</code> | NAV: <code>{nav_str}</code>\n"
            f"  - 상태: {status_badge}\n\n"
        )
        
    footer = "💡 <i>괴리율이 큰 상태에서 시장가 주문을 넣을 경우 불리한 가격에 체결될 수 있으므로, 지정가 주문을 활용하거나 괴리율 안정화 후 매매하는 것을 권장합니다.</i>"
    
    full_message = header + body + footer
    results = await broadcast_notification(
        full_message, 
        category="disparity", 
        title=f"🚨 [ETF 괴리율 경보] {len(alert_items)}개 종목 감지"
    )
    print(f"[DisparityAlert] Sent disparity alert for {len(alert_items)} items: {results}")


def setup_scheduler():
    from scheduler.etf_price_sync import sync_etf_prices_yfinance
    from core.etf_performance import update_all_etf_performance_job
    from core.db_replicator import trigger_replication_background

    import gc

    # wrapper: 각 job 완료 후 버전 자동 업데이트 및 PostgreSQL 복제 트리거
    async def _job_master():
        await sync_etf_master_list()
        await update_app_version("[master]")
        trigger_replication_background()
        gc.collect()

    async def _job_batch():
        await sync_etf_batch()
        await update_app_version("[batch]")
        trigger_replication_background()
        gc.collect()

    async def _job_price():
        await sync_etf_prices_yfinance()
        await update_app_version("[price]")
        trigger_replication_background()
        gc.collect()

    async def _job_perf():
        await update_all_etf_performance_job()
        await update_app_version("[perf]")
        await check_exit_signal_and_alert()
        trigger_replication_background()
        gc.collect()

    async def _job_macro():
        from api.exit_signal import sync_us_macro_indicators_job
        await sync_us_macro_indicators_job()
        await update_app_version("[macro]")
        trigger_replication_background()
        gc.collect()

    async def _job_disparity():
        await check_etf_disparity_and_alert()
        trigger_replication_background()
        gc.collect()

    async def _job_brazil():
        from core.brazil_fetcher import sync_brazil_series
        from api.brazil_bond import (
            check_brazil_signal_and_alert, send_brazil_dashboard_digest,
            check_brazil_all_green_and_alert,
        )
        await sync_brazil_series()
        await check_brazil_signal_and_alert()
        await send_brazil_dashboard_digest()       # 매일 아침 대시보드 브리핑
        await check_brazil_all_green_and_alert()   # 모든 지표 초록불 전환 감지
        await update_app_version("[brazil]")
        trigger_replication_background()
        gc.collect()

    async def _job_brazil_intraday():
        """실시간 수집 및 COPOM Selic 변경·신호 전환·초록불 감지 주기 모니터링 (15분 간격)."""
        from core.brazil_fetcher import sync_brazil_series
        from api.brazil_bond import (
            check_brazil_signal_and_alert,
            check_brazil_all_green_and_alert,
        )
        try:
            await sync_brazil_series()
            await check_brazil_signal_and_alert()
            await check_brazil_all_green_and_alert()
        except Exception as e:
            print(f"[scheduler] _job_brazil_intraday failed: {e}")

    async def _job_asset_snapshot():
        """장 마감(15:30) 후 KIS 포트폴리오를 조회하여 일일 자산 추이(UserAssetSnapshot)를 DB에 자동 영속화."""
        try:
            from api.my_assets import record_daily_asset_snapshot_job
            await record_daily_asset_snapshot_job()
            trigger_replication_background()
            gc.collect()
        except Exception as e:
            print(f"[scheduler] _job_asset_snapshot failed: {e}")

    async def _job_dividend_refresh():
        """14일 이상 경과하여 만료(stale)된 배당 요약본을 주간 단위로 자동 갱신."""
        try:
            from core.dividend_scraper import refresh_stale_dividends_job
            await refresh_stale_dividends_job(limit=50)
            trigger_replication_background()
            gc.collect()
        except Exception as e:
            print(f"[scheduler] _job_dividend_refresh failed: {e}")

    async def _job_keep_alive():
        """Render 유휴 스핀다운 방지: 자기 자신의 /health 를 호출해 idle 타이머를 리셋한다.
        RENDER_EXTERNAL_URL(렌더가 자동 주입)이 없으면 로컬/비-Render 환경이므로 no-op."""
        import os
        base = os.environ.get("RENDER_EXTERNAL_URL")
        if not base:
            return
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(f"{base.rstrip('/')}/health")
            print(f"[keep-alive] ping {base}/health -> {r.status_code}")
        except Exception as e:
            print(f"[keep-alive] ping 실패: {e}")

    # 07:00 - 경량 ETF 마스터 목록 upsert
    scheduler.add_job(_job_master, "cron", hour=7, minute=0, id="daily_etf_master_sync")

    # 18:00 - 무거운 ETF 전체 sync (가격/보유종목 포함)
    scheduler.add_job(_job_batch, "cron", hour=18, minute=0, id="daily_db_sync")

    # 20:00 - yfinance 경량 시세 배치 (batch 완료 후 충분히 여유를 두고 실행)
    scheduler.add_job(_job_price, "cron", hour=20, minute=0, id="daily_etf_price_yfinance")

    # 21:00 - ETF 수익률/변동성/샤프 계산 (price sync 완료 후 실행)
    scheduler.add_job(_job_perf, "cron", hour=21, minute=0, id="daily_perf_calc")

    # 매월 1일 08:00 - 미국 매크로 지표 동기화
    scheduler.add_job(_job_macro, "cron", day=1, hour=8, minute=0, id="monthly_us_macro_sync")

    # 월-금 09:10 (Market Open) 및 15:15 (Market Close) 실행
    scheduler.add_job(_job_disparity, "cron", day_of_week="mon-fri", hour=9, minute=10, id="market_open_disparity_check")
    scheduler.add_job(_job_disparity, "cron", day_of_week="mon-fri", hour=15, minute=15, id="market_close_disparity_check")

    # 월-금 15:40 - 장 마감 후 일일 자산 총액 및 포트폴리오 스냅샷 자동 기록
    scheduler.add_job(_job_asset_snapshot, "cron", day_of_week="mon-fri", hour=15, minute=40, id="market_close_asset_snapshot")

    # 매주 일요일 23:30 - 14일 이상 지난 배당 데이터(ETFDividendSummary) 백그라운드 자동 갱신
    scheduler.add_job(_job_dividend_refresh, "cron", day_of_week="sun", hour=23, minute=30, id="weekly_dividend_refresh")

    # 매일 08:30 (KST) - 브라질 국채 매크로 시계열 동기화 + 신호 전환 알림 + 아침 대시보드 브리핑
    scheduler.add_job(_job_brazil, "cron", hour=8, minute=30, id="daily_brazil_series_sync")

    # 15분마다 - 브라질 국채 실시간 수집 + COPOM Selic 금리 변경 / 신호 전환 / 초록불 핫 알림
    scheduler.add_job(_job_brazil_intraday, "interval", minutes=15, id="brazil_intraday_check")

    # 10분마다 self-ping → Render idle(15분) 스핀다운 방지. 외부 서버/서비스 불필요.
    # RENDER_EXTERNAL_URL 미설정(로컬) 시 잡은 실행돼도 즉시 no-op.
    scheduler.add_job(_job_keep_alive, "interval", minutes=10, id="render_keep_alive")

    scheduler.start()
    print("DB and Email Scheduler started.")


