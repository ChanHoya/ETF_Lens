# i-Prism 로고타입·아이콘 SVG와 파비콘을 생성하는 스크립트 (시안 H2 확정본)
"""
실행: backend/venv/bin/python dashboard/scripts/generate-brand.py
필요: fontTools(글자 윤곽), Pillow(favicon.ico), playwright + chromium(PNG 렌더, PLAYWRIGHT_BROWSERS_PATH)

- PRISM 글자는 Bricolage Grotesque(wght 800, opsz 96) 윤곽을 path로 바꿔 폰트 없이도 같은 모양이 나오게 한다.
- 광선은 SVG에 원뿔형 그라데이션이 없어 가는 조각으로 나누고 조각마다 보간 색을 채운다(부채꼴 방향 그라데이션).
- 생성물은 커밋한다. 로고를 바꿀 때는 이 스크립트를 고치고 다시 실행한다(생성물 직접 수정 금지).
"""
import io
import os
import urllib.request
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]  # dashboard/
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz,wdth,wght%5D.ttf"
FONT_CACHE = Path(os.environ.get("TMPDIR", "/tmp")) / "BricolageGrotesque-var.ttf"

# 어두운 화면용 스펙트럼(빨강·주황·노랑·청록·파랑) = 국내주식·해외주식·채권·대체·현금성
RAYS = ["#ff5a5f", "#ff9f1c", "#ffd23f", "#22b8a7", "#4d7cfe"]
INK = "#f2f3f8"      # 독립 SVG·타일에서 i 줄기·프리즘 윤곽 색
TILE = "#0b0d14"     # 앱 아이콘 타일 배경

# 로고타입 기하(시안 H2): 역삼각형 프리즘 (14,50)-(46,50)-(30,78), i 줄기, Prism 글자 120px·기준선 120
FONT_SIZE, BASELINE, TEXT_X = 120, 120, 108
RAY_END_X = TEXT_X - 6


def face(t):  # 프리즘 오른쪽 면 위의 점(위 꼭짓점 → 아래 꼭짓점)
    return (46 - 16 * t, 50 + 28 * t)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def spectrum_at(u):
    seg = min(len(RAYS) - 2, int(u * (len(RAYS) - 1)))
    f = u * (len(RAYS) - 1) - seg
    a, b = hex_rgb(RAYS[seg]), hex_rgb(RAYS[seg + 1])
    return "#%02x%02x%02x" % tuple(round(a[i] + (b[i] - a[i]) * f) for i in range(3))


def fan_slices(A, B, C, D, n):
    """시작 변 A→B와 끝 변 C→D를 같은 비율로 n등분한 조각들. 색 띠가 부채꼴로 벌어진다.
    조각을 1.6칸씩 겹쳐 안티앨리어싱 틈을 없앤다."""
    lerp = lambda P, Q, u: (P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u)
    out = []
    for k in range(n):
        u0, u1 = k / n, min(1.0, (k + 1.6) / n)
        pts = [lerp(A, B, u0), lerp(A, B, u1), lerp(C, D, u1), lerp(C, D, u0)]
        d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"
        out.append((d, spectrum_at((k + 0.5) / n)))
    return out


def load_font():
    if not FONT_CACHE.exists():
        urllib.request.urlretrieve(FONT_URL, FONT_CACHE)
    font = TTFont(FONT_CACHE)
    return instancer.instantiateVariableFont(font, {"wght": 800, "opsz": 96, "wdth": 100})


def build_logotype(font):
    upm = font["head"].unitsPerEm
    scale = FONT_SIZE / upm
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    x = TEXT_X
    glyph_paths, centers = [], []
    for ch in "Prism":
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, BASELINE)))
        adv = hmtx[name][0] * scale
        glyph_paths.append(pen.getCommands())
        centers.append(x + adv / 2)
        x += adv
    text_end = x
    cap_top = BASELINE - font["OS/2"].sCapHeight * scale
    ends = [cap_top + (BASELINE - cap_top) * i / 5 for i in range(6)]
    slices = fan_slices(face(0.2), face(0.8), (RAY_END_X, ends[0]), (RAY_END_X, ends[5]), 56)
    stops = [((c - TEXT_X) / (text_end - TEXT_X), RAYS[i]) for i, c in enumerate(centers)]
    vb = (0, round(cap_top - 3, 2), round(text_end + 4, 2), round(BASELINE + 4 - (cap_top - 3), 2))
    return {"glyphs": glyph_paths, "slices": slices, "stops": stops, "text_x1": TEXT_X, "text_x2": round(text_end, 2), "viewBox": vb}


def build_mark():
    # 아이콘(100×100): 역삼각형 (14,10)-(66,10)-(40,50), 줄기, 오른쪽 면 t=0.2~0.8에서 (98,6)~(98,86)로 퍼지는 광선
    f = lambda t: (66 - 26 * t, 10 + 40 * t)
    return {"slices": fan_slices(f(0.2), f(0.8), (98, 6), (98, 86), 40)}


# ── SVG 조립 ────────────────────────────────────────────────────────────────
def logotype_svg(L, ink):
    slices = "".join(f'<path d="{d}" fill="{c}"/>' for d, c in L["slices"])
    stops = "".join(f'<stop offset="{o:.4f}" stop-color="{c}"/>' for o, c in L["stops"])
    glyphs = "".join(f'<path d="{p}"/>' for p in L["glyphs"])
    vb = " ".join(str(v) for v in L["viewBox"])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="i-Prism">'
            f'<defs><linearGradient id="ip-beam" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="20.4" y2="0">'
            f'<stop offset="0" stop-color="{ink}" stop-opacity="0"/><stop offset="1" stop-color="{ink}"/></linearGradient>'
            f'<linearGradient id="ip-text" gradientUnits="userSpaceOnUse" x1="{L["text_x1"]}" y1="0" x2="{L["text_x2"]}" y2="0">{stops}</linearGradient></defs>'
            f'<path d="M0 58 L20.4 61.2" stroke="url(#ip-beam)" stroke-width="3.4" stroke-linecap="round" fill="none"/>'
            f'<g>{slices}</g>'
            f'<path d="M14 50 L46 50 L30 78 Z" fill="{ink}" fill-opacity="0.12" stroke="{ink}" stroke-width="3.2" stroke-linejoin="round"/>'
            f'<rect x="24" y="86" width="12" height="34" rx="4" fill="{ink}"/>'
            f'<g fill="url(#ip-text)">{glyphs}</g></svg>')


def mark_inner(M, ink, beam_id):
    slices = "".join(f'<path d="{d}" fill="{c}"/>' for d, c in M["slices"])
    return (f'<defs><linearGradient id="{beam_id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="23.1" y2="0">'
            f'<stop offset="0" stop-color="{ink}" stop-opacity="0"/><stop offset="1" stop-color="{ink}"/></linearGradient></defs>'
            f'<path d="M0 22 L23.1 24" stroke="url(#{beam_id})" stroke-width="3.6" stroke-linecap="round" fill="none"/>'
            f'<g>{slices}</g>'
            f'<path d="M14 10 L66 10 L40 50 Z" fill="{ink}" fill-opacity="0.12" stroke="{ink}" stroke-width="3.6" stroke-linejoin="round"/>'
            f'<rect x="33" y="58" width="14" height="36" rx="4.5" fill="{ink}"/>')


def tile_svg(M):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<rect x="2" y="2" width="96" height="96" rx="24" fill="{TILE}"/>'
            f'<svg x="9" y="9" width="82" height="82" viewBox="0 0 100 100">{mark_inner(M, INK, "ip-tile-beam")}</svg></svg>')


def react_component(L, M):
    def arr(slices):
        return "[\n" + "".join(f"  ['{d}', '{c}'],\n" for d, c in slices) + "]"
    stops = ", ".join(f"[{o:.4f}, '{c}']" for o, c in L["stops"])
    glyphs = "[\n" + "".join(f"  '{p}',\n" for p in L["glyphs"]) + "]"
    vb = " ".join(str(v) for v in L["viewBox"])
    return f"""'use client';
// i-Prism 로고타입(IPrismLogo)과 아이콘 마크(IPrismMark) SVG 컴포넌트 — scripts/generate-brand.py가 생성, 직접 수정 금지
import {{ useId }} from 'react';

const LOGO_FAN: [string, string][] = {arr(L["slices"])};
const MARK_FAN: [string, string][] = {arr(M["slices"])};
const PRISM_GLYPHS: string[] = {glyphs};
const PRISM_STOPS: [number, string][] = [{stops}];

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');

/** 역삼각형 프리즘 i + 부채꼴 스펙트럼 + 그라데이션 PRISM. i 줄기·프리즘 윤곽은 currentColor를 따른다. */
export function IPrismLogo({{ className, title = 'i-Prism' }}: {{ className?: string; title?: string }}) {{
    const id = safeId(useId());
    return (
        <svg viewBox="{vb}" className={{className}} role="img" aria-label={{title}}>
            <defs>
                <linearGradient id={{`${{id}}-beam`}} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="20.4" y2="0">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                    <stop offset="1" stopColor="currentColor" />
                </linearGradient>
                <linearGradient id={{`${{id}}-text`}} gradientUnits="userSpaceOnUse" x1="{L["text_x1"]}" y1="0" x2="{L["text_x2"]}" y2="0">
                    {{PRISM_STOPS.map(([o, c]) => <stop key={{o}} offset={{o}} stopColor={{c}} />)}}
                </linearGradient>
            </defs>
            <path d="M0 58 L20.4 61.2" stroke={{`url(#${{id}}-beam)`}} strokeWidth={{3.4}} strokeLinecap="round" fill="none" />
            <g>{{LOGO_FAN.map(([d, c], i) => <path key={{i}} d={{d}} fill={{c}} />)}}</g>
            <path d="M14 50 L46 50 L30 78 Z" fill="currentColor" fillOpacity={{0.12}} stroke="currentColor" strokeWidth={{3.2}} strokeLinejoin="round" />
            <rect x="24" y="86" width="12" height="34" rx="4" fill="currentColor" />
            <g fill={{`url(#${{id}}-text)`}}>{{PRISM_GLYPHS.map((d, i) => <path key={{i}} d={{d}} />)}}</g>
        </svg>
    );
}}

/** 글자 없는 아이콘 마크(100×100). 파비콘·로딩·비밀번호 화면용. */
export function IPrismMark({{ className, title = 'i-Prism' }}: {{ className?: string; title?: string }}) {{
    const id = safeId(useId());
    return (
        <svg viewBox="0 0 100 100" className={{className}} role="img" aria-label={{title}}>
            <defs>
                <linearGradient id={{`${{id}}-beam`}} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="23.1" y2="0">
                    <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                    <stop offset="1" stopColor="currentColor" />
                </linearGradient>
            </defs>
            <path d="M0 22 L23.1 24" stroke={{`url(#${{id}}-beam)`}} strokeWidth={{3.6}} strokeLinecap="round" fill="none" />
            <g>{{MARK_FAN.map(([d, c], i) => <path key={{i}} d={{d}} fill={{c}} />)}}</g>
            <path d="M14 10 L66 10 L40 50 Z" fill="currentColor" fillOpacity={{0.12}} stroke="currentColor" strokeWidth={{3.6}} strokeLinejoin="round" />
            <rect x="33" y="58" width="14" height="36" rx="4.5" fill="currentColor" />
        </svg>
    );
}}
"""


def render_pngs(tile):
    """타일 SVG를 크롬으로 렌더해 apple-icon.png(180)와 favicon.ico(16·32·48)를 만든다."""
    from PIL import Image
    from playwright.sync_api import sync_playwright
    sizes = {}
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    launch_kwargs = {"executable_path": chrome_path} if os.path.exists(chrome_path) else {}
    with sync_playwright() as p:
        b = p.chromium.launch(**launch_kwargs)
        pg = b.new_page()
        for s in (180, 48, 32, 16):
            pg.set_viewport_size({"width": s, "height": s})
            sized = tile.replace("<svg ", f'<svg width="{s}" height="{s}" ', 1)
            pg.set_content(f'<html><body style="margin:0;background:transparent">{sized}</body></html>')
            sizes[s] = Image.open(io.BytesIO(pg.screenshot(omit_background=True))).convert("RGBA")
        b.close()
    sizes[180].save(ROOT / "src/app/apple-icon.png")
    sizes[48].save(ROOT / "src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)],
                   append_images=[sizes[16], sizes[32]])


def main():
    font = load_font()
    L, M = build_logotype(font), build_mark()
    (ROOT / "src/components/brand").mkdir(parents=True, exist_ok=True)
    (ROOT / "public/brand").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/components/brand/IPrismLogo.tsx").write_text(react_component(L, M), encoding="utf-8")
    (ROOT / "public/brand/iprism-logo.svg").write_text(logotype_svg(L, INK), encoding="utf-8")
    tile = tile_svg(M)
    (ROOT / "public/brand/iprism-icon.svg").write_text(tile, encoding="utf-8")
    (ROOT / "src/app/icon.svg").write_text(tile, encoding="utf-8")
    render_pngs(tile)
    print("viewBox", L["viewBox"], "stops", [round(o, 3) for o, _ in L["stops"]])


if __name__ == "__main__":
    main()
