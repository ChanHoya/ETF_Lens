# Tailwind 기본 팔레트를 반전해 라이트 모드 CSS(src/app/theme-light.css)를 생성하는 스크립트
"""
실행: python3 dashboard/scripts/generate-light-theme.py  (dashboard/node_modules 필요)

앱은 어두운 화면 전제로 text-white, bg-black/20, text-gray-400 같은 클래스를 쓴다. Tailwind v4 유틸리티는
색을 CSS 변수로 참조하므로 html.light에서 변수만 다시 정의하면 앱 전체가 라이트로 바뀐다.
- 흑백 교환: --color-black ↔ --color-white(순흑 대신 잉크색)
- 색 단계 반전: 50↔950, 100↔900, 200↔800, 300↔700, 400↔600, 500 유지
hex 직접 지정 클래스(bg-[#161922] 등)는 변수를 거치지 않아 속성 선택자로 덮어쓴다.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "node_modules/tailwindcss/theme.css"
OUT = ROOT / "src/app/theme-light.css"

INK = "#10131a"          # 라이트에서 text-white가 될 글자색
INK_RGB = "16 19 26"
PAPER = "#ffffff"        # 라이트에서 bg-black/xx가 될 면 색
PAGE_BG = "#e6eaf1"      # 페이지 바탕 — 흰 카드와 구분되도록 회색 기운을 둔다
SURFACE = "#ffffff"      # hex로 지정된 어두운 카드 배경 대체(불투명 — sticky 헤더 비침 방지)
MIRROR = {"50": "950", "100": "900", "200": "800", "300": "700", "400": "600",
          "600": "400", "700": "300", "800": "200", "900": "100", "950": "50"}

# 반투명 흰 테두리(border-white/N) → 라이트에서 잉크 농도
BORDER_ALPHA = {"5": 0.12, "10": 0.16, "15": 0.2, "20": 0.26}
# 흰 바탕에서 대비가 2~3:1에 그치는 노랑 계열 글자 → 700 단계
WEAK_TEXT_HUES = ["yellow", "amber", "lime", "orange"]
WEAK_TEXT_SHADES = ["400", "500"]
TEXT_ALPHAS = [None, "60", "70", "80", "90"]
# 차트·인라인 style에 hex로 박힌 색 → 라이트용 글자색. 키는 원래 hex, 값은 (rgb 정규화 문자열, 대체색)
GRAY_TEXT = "#4b5563"
HEX_TEXT = {
    "#fbbf24": "#b45309", "#f59e0b": "#b45309", "#fcd34d": "#b45309",
    "#eab308": "#a16207", "#facc15": "#a16207", "#fde047": "#a16207",
    "#84cc16": "#4d7c0f", "#a3e635": "#4d7c0f",
    "#f97316": "#c2410c", "#fb923c": "#c2410c",
    # 어두운 바탕용 파스텔 시리즈색(차트 라벨·범례·툴팁 글자) — 선 색은 그대로 두고 글자만 진하게
    "#34d399": "#047857", "#10b981": "#047857", "#4ade80": "#15803d", "#22c55e": "#15803d",
    "#60a5fa": "#1d4ed8", "#3b82f6": "#1d4ed8", "#38bdf8": "#0369a1", "#22d3ee": "#0e7490",
    "#818cf8": "#4338ca", "#a5b4fc": "#4338ca", "#a78bfa": "#6d28d9", "#c084fc": "#7e22ce",
    "#f87171": "#b91c1c", "#fb7185": "#be123c", "#f472b6": "#be185d",
    "#9ca3af": GRAY_TEXT, "#94a3b8": GRAY_TEXT, "#a1a1aa": GRAY_TEXT,
    "#cbd5e1": GRAY_TEXT, "#d1d5db": GRAY_TEXT, "#e2e8f0": GRAY_TEXT, "#e5e7eb": GRAY_TEXT,
}
# 어두운 바탕 기준으로 옅게 칠한 차트 면(fill-opacity, 그라데이션 stop-opacity) → 라이트에서 진하게
FILL_OPACITY_BOOST = 1.6
FILL_OPACITIES = ["0.06", "0.08", "0.1", "0.12", "0.15", "0.2", "0.25", "0.28", "0.3", "0.4"]


def _rgb(hex_color):
    h = hex_color.lstrip("#")
    return ", ".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def _inline_color(hex_color):
    """React가 남기는 인라인 color 표기 두 가지(클라이언트 rgb 정규화, SSR 원문)를 고르는 선택자.
    ' color:' 앞 공백으로 background-color와 구분한다."""
    rgb = f"rgb({_rgb(hex_color)})"
    return [f'[style^="color: {rgb}"]', f'[style*=" color: {rgb}"]',
            f'[style^="color:{hex_color}" i]', f'[style*=";color:{hex_color}" i]']


def readability_css(colors):
    """라이트에서 흐릿해지는 카드 테두리·차트 축/라벨·툴팁·노랑 글자 보정 규칙.
    반환: (rules, util) — rules는 SVG 속성·인라인 style을 덮는 !important 규칙(Tailwind 변수를 거치지 않는 색),
    util은 utilities 레이어에 넣을 클래스 보정(:where로 특이도를 낮춰 hover: 등 변형이 계속 이긴다)."""
    rules, util = [], []
    # 반투명 흰 테두리 진하게, 카드(둥근 모서리 + 반투명 흰/검정·어두운 hex 면)는 흰 카드 + 옅은 그림자
    for n, a in BORDER_ALPHA.items():
        util.append(f":where(html.light) .border-white\\/{n} {{ border-color: rgb({INK_RGB} / {a}); }}")
    util.append(
        ":where(html.light) :is(.rounded-2xl, .rounded-3xl):is([class*=\"bg-white/\"], [class*=\"bg-black/\"], "
        "[class*=\"bg-[#0\"], [class*=\"bg-[#1\"], [class*=\"bg-[#2\"]) {\n"
        f"    background-color: {PAPER};\n"
        f"    box-shadow: 0 1px 2px rgb({INK_RGB} / 0.06), 0 4px 16px rgb({INK_RGB} / 0.06);\n  }}")
    # 노랑 계열 글자 클래스 → 원래 팔레트의 700 단계
    for hue in WEAK_TEXT_HUES:
        for shade in WEAK_TEXT_SHADES:
            target = colors[f"{hue}-700"]
            for alpha in TEXT_ALPHAS:
                cls = f".text-{hue}-{shade}" + (f"\\/{alpha}" if alpha else "")
                value = target if not alpha else f"color-mix(in oklab, {target} {alpha}%, transparent)"
                util.append(f":where(html.light) {cls} {{ color: {value}; }}")
    # hex로 박힌 글자색(SVG text fill, 인라인 color)
    for hex_color, repl in HEX_TEXT.items():
        sel = [f'html.light svg text[fill="{hex_color}" i]']
        sel += [f"html.light {s}" for s in _inline_color(hex_color)]
        rules.append(",\n".join(sel) + f" {{\n  fill: {repl} !important;\n  color: {repl} !important;\n}}")
    # 흰색 계열 SVG 글자(축 눈금·기준선 라벨)
    white_text = ['[fill^="rgba(255,255,255"]', '[fill^="rgba(255, 255, 255"]',
                  '[fill="#fff" i]', '[fill="#ffffff" i]', '[fill="white"]', '[fill="#f3f4f6" i]']
    rules.append(",\n".join(f"html.light svg text{s}" for s in white_text)
                 + f" {{\n  fill: rgb({INK_RGB} / 0.72) !important;\n}}")
    # 반투명 흰 글자 인라인 style(툴팁·범례 보조 문구)
    white_inline = ['[style^="color: rgba(255, 255, 255"]', '[style*=" color: rgba(255, 255, 255"]',
                    '[style^="color:rgba(255,255,255"]', '[style*=";color:rgba(255,255,255"]']
    rules.append(",\n".join(f"html.light {s}" for s in white_inline)
                 + f" {{\n  color: rgb({INK_RGB} / 0.72) !important;\n}}")
    # 흰색 계열 선: 중간 농도(축선·구분선) → 잉크 28%, 아주 옅은 격자 → 잉크 10%
    mid = ['[stroke^="rgba(255,255,255,0."]', '[stroke^="rgba(255, 255, 255, 0."]',
           '[stroke="#ffffff30" i]', '[stroke="#ffffff50" i]']
    low = ['[stroke^="rgba(255,255,255,0.0"]', '[stroke^="rgba(255, 255, 255, 0.0"]',
           '[stroke="#ffffff08" i]', '[stroke="#ffffff10" i]', '[stroke="#ffffff20" i]']
    rules.append(",\n".join(f"html.light svg {s}" for s in mid) + f" {{\n  stroke: rgb({INK_RGB} / 0.28) !important;\n}}")
    rules.append(",\n".join(f"html.light svg {s}" for s in low)
                 + f",\nhtml.light .recharts-cartesian-grid [stroke=\"#1e293b\" i]"
                 + f" {{\n  stroke: rgb({INK_RGB} / 0.1) !important;\n}}")
    # 흰 점선 기준선(목표 환율·금리 등)
    rules.append(",\n".join(f"html.light .recharts-reference-line-line{s}"
                            for s in ['[stroke="#ffffff" i]', '[stroke="#fff" i]', '[stroke="white"]'])
                 + f" {{\n  stroke: rgb({INK_RGB} / 0.55) !important;\n}}")
    # 옅은 면 채움 강화
    for v in FILL_OPACITIES:
        boosted = round(min(float(v) * FILL_OPACITY_BOOST, 0.6), 3)
        rules.append(f'html.light svg [fill-opacity="{v}"] {{ fill-opacity: {boosted}; }}')
        rules.append(f'html.light svg stop[stop-opacity="{v}"] {{ stop-opacity: {boosted}; }}')
    # 차트 툴팁: 인라인 어두운 배경 → 흰 카드
    rules.append(
        "html.light .recharts-default-tooltip,\nhtml.light .recharts-tooltip-wrapper > div {\n"
        f"  background: {PAPER} !important;\n"
        f"  border: 1px solid rgb({INK_RGB} / 0.14) !important;\n"
        f"  box-shadow: 0 8px 24px rgb({INK_RGB} / 0.14) !important;\n"
        f"  color: {INK} !important;\n}}")
    rules.append(
        "html.light .recharts-tooltip-wrapper [style^=\"color: rgb(255, 255, 255)\"],\n"
        "html.light .recharts-tooltip-wrapper [style*=\" color: rgb(255, 255, 255)\"],\n"
        "html.light .recharts-tooltip-wrapper [style^=\"color:#fff\" i] {\n"
        f"  color: {INK} !important;\n}}")
    return rules, util


def main():
    text = THEME.read_text(encoding="utf-8")
    colors = dict(re.findall(r"--color-([a-z]+-\d+):\s*([^;]+);", text))
    lines = []
    for name, value in colors.items():
        hue, shade = name.rsplit("-", 1)
        mirror = MIRROR.get(shade)
        if mirror and f"{hue}-{mirror}" in colors:
            lines.append(f"  --color-{name}: {colors[f'{hue}-{mirror}']};")
    hex_prefixes = ["0", "1", "2"]  # #0xxxxx~#2xxxxx = 어두운 면
    bg_sel = ",\n".join(f'html.light [class*="bg-[#{p}"]' for p in hex_prefixes)
    grad = "\n".join(
        f'html.light [class*="{k}-[#{p}"] {{ --tw-gradient-{k}: {PAPER} !important; }}'
        for k in ("from", "via", "to") for p in hex_prefixes)
    rules, util = readability_css(colors)
    util_css = "\n".join("  " + u for u in util)
    rules_css = "\n\n".join(rules)
    css = f"""/* 라이트 모드 팔레트 — scripts/generate-light-theme.py가 생성, 직접 수정 금지 */
html.light {{
  color-scheme: light;
  --color-black: {PAPER};
  --color-white: {INK};
{chr(10).join(lines)}
}}

html.light,
html.light body {{
  color: {INK};
  background-color: {PAGE_BG};
}}

/* hex로 직접 지정한 어두운 카드·패널 배경 */
{bg_sel} {{
  background-color: {SURFACE} !important;
}}

/* hex로 직접 지정한 어두운 그라데이션 정지점 */
{grad}

/* 카드 테두리·유리 카드·노랑 계열 글자 클래스 보정 */
@layer utilities {{
{util_css}
}}

/* 차트(SVG 속성)·인라인 style 색 보정 */
{rules_css}
"""
    OUT.write_text(css, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(lines)} palette vars")


if __name__ == "__main__":
    main()
