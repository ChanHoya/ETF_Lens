import asyncio, httpx, os, sys
sys.path.insert(0, "/Users/chanhojung/ETF_One/backend")
os.chdir("/Users/chanhojung/ETF_One/backend")
from dotenv import load_dotenv
load_dotenv("/Users/chanhojung/ETF_One/backend/.env", override=True)

KIS_URL    = os.environ.get("KIS_URL_BASE","https://openapi.koreainvestment.com:9443")
APP_KEY    = os.environ.get("KIS_APP_KEY1","").strip()
APP_SECRET = os.environ.get("KIS_APP_SECRET1","").strip()
ACC_RAW    = os.environ.get("KIS_ACC1","").strip()

async def main():
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{KIS_URL}/oauth2/tokenP", json={
            "grant_type":"client_credentials","appkey":APP_KEY,"appsecret":APP_SECRET})
        token = r.json().get("access_token","")
    print(f"token ok={bool(token)}")
    if not token: return

    digits = "".join(filter(str.isdigit, ACC_RAW))
    cano, acnt = digits[:8], digits[8:] or "01"
    is_mock = "vts" in KIS_URL
    print(f"account={cano}-{acnt} mock={is_mock}")

    from datetime import datetime
    today = datetime.now().strftime("%Y%m%d")
    headers = {
        "content-type":"application/json; charset=utf-8",
        "authorization":f"Bearer {token}",
        "appkey":APP_KEY,"appsecret":APP_SECRET,
        "tr_id":"VTTC8001R" if is_mock else "TTTC8001R",
        "custtype":"P"
    }
    params = {
        "CANO":cano,"ACNT_PRDT_CD":acnt,
        "INQR_STRT_DT":today,"INQR_END_DT":today,
        "SLL_BUY_DVSN_CD":"00","INQR_DVSN":"00","PDNO":"",
        "CCLD_DVSN":"01","ORD_GNO_BRNO":"","ODNO":"",
        "INQR_DVSN_3":"00","INQR_DVSN_1":"",
        "CTX_AREA_FK100":"","CTX_AREA_NK100":""
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{KIS_URL}/uapi/domestic-stock/v1/trading/inquire-daily-ccld",
            headers=headers, params=params)
        d = r.json()

    print(f"rt_cd={d.get('rt_cd')} msg={d.get('msg1','')[:80]}")
    rows = d.get("output1",[])
    print(f"체결건수={len(rows)}")
    if rows:
        s = rows[0]
        print(f"필드={list(s.keys())}")
        print(f"종목={s.get('prdt_name')} 구분={s.get('sll_buy_dvsn_cd_name')} 수량={s.get('tot_ccld_qty')} 단가={s.get('avg_prvs')}")
    else:
        print("오늘 체결 없음")

asyncio.run(main())
