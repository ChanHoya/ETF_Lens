# 브라질 국채 엔드포인트(summary/history)와 신호 엔진 경계값을 검증하는 스크래치 스크립트
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from api.brazil_bond import compute_signal, carry_cushion_curve

client = TestClient(app)

print("=== 신호 엔진 경계값 유닛 테스트 ===")
cases = [
    (14.28, 293.0, "WATCH"),     # 금리 OK, 환율 미충족(>290)
    (14.28, 289.0, "TRANCHE1"),  # 둘 다 충족, 금리 14.2~14.7
    (14.8, 288.0, "TRANCHE2"),   # 둘 다 충족, 금리 ≥14.7
    (13.9, 285.0, "WATCH"),      # 금리 미충족(<14.2)
    (15.3, 280.0, "RISK_REASSESS"),  # 금리 >15.0
    (None, 289.0, "UNKNOWN"),
]
ok = True
for y5, fx, expect in cases:
    z = compute_signal(y5, fx)["zone"]
    mark = "✓" if z == expect else "✗"
    if z != expect:
        ok = False
    print(f"  {mark} y5={y5} fx={fx} → {z} (expect {expect})")
print(f"신호 엔진: {'PASS' if ok else 'FAIL'}")

print("\n=== 캐리 쿠션 곡선 (entry 294) ===")
for p in carry_cushion_curve(294.0):
    print(f"  만기 {p['fx_end']}원 ({p['fx_change_pct']:+.1f}%) → 누적 {p['total_return_pct']:+.1f}% / CAGR {p['cagr_pct']:.1f}%"
          + ("  ← 손익분기" if p["is_breakeven"] else ""))

print("\n=== GET /api/v1/brazil-bond/summary ===")
r = client.get("/api/v1/brazil-bond/summary")
print("status:", r.status_code)
if r.status_code == 200:
    d = r.json()
    print("as_of:", d["as_of"])
    for i in d["indicators"]:
        print(f"  [{i['gauge']:5s}] {i['label']}: {i['value']} {i['unit']} (Δ{i['change']})")
    print("  실질금리:", d["real_rate"]["value"], "gauge:", d["real_rate"]["gauge"])
    print("  Focus:", d["focus"])
    s = d["signal"]
    print(f"  SIGNAL: [{s['zone']}] {s['grade']} — {s['headline']}")
    print(f"          action: {s['action']}")
    nc = d["next_catalyst"]
    print(f"  다음 이벤트: {nc['title']} D-{nc['d_day']} ({nc['date']})" if nc else "  다음 이벤트: 없음")
    print("  캐리쿠션 포인트:", len(d["carry_cushion"]), "/ 시나리오:", len(d["aug_scenarios"]),
          "/ 트랜치:", len(d["tranches"]), "/ 체크리스트:", len(d["due_diligence"]))
else:
    print(r.text[:400])

print("\n=== GET /api/v1/brazil-bond/history?series=selic_target,y5,ipca_12m,brl_krw ===")
r = client.get("/api/v1/brazil-bond/history", params={"series": "selic_target,y5,ipca_12m,brl_krw", "years": 10})
print("status:", r.status_code)
if r.status_code == 200:
    for k, v in r.json()["series"].items():
        print(f"  {k}: {len(v)} points" + (f", last={v[-1]}" if v else ""))
else:
    print(r.text[:400])
