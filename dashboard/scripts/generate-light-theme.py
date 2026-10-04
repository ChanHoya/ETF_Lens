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
PAPER = "#ffffff"        # 라이트에서 bg-black/xx가 될 면 색
PAGE_BG = "#eef1f6"      # 페이지 바탕
SURFACE = "rgb(255 255 255 / 0.92)"  # hex로 지정된 어두운 카드 배경 대체
MIRROR = {"50": "950", "100": "900", "200": "800", "300": "700", "400": "600",
          "600": "400", "700": "300", "800": "200", "900": "100", "950": "50"}


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
"""
    OUT.write_text(css, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(lines)} palette vars")


if __name__ == "__main__":
    main()
