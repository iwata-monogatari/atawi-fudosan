#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
富士ヶ丘サービス 不動産ブログ用 表紙バナー生成スクリプト（正方形版）
参考記事 entry-803677 と同系統の「緑フラットデザイン」バナー(760x760 JPG)を作る。

使い方:
  python3 make_cover_square.py --line1 "農地付きの実家、" --line2 "あきらめる前に。" \
      --sub "磐田・袋井の田畑つき不動産と、2023年の農地法改正" --out cover.jpg

必要: Pillow（PIL）と日本語フォント Noto Sans CJK JP
  pip install pillow --break-system-packages
フォントが別パスの場合は --font / --font-regular で指定。
（指定が無い/見つからない場合は Linux・Windows の代表的なCJKフォントを自動探索する）
"""
import argparse, math, os
from PIL import Image, ImageDraw, ImageFont

# 既定（Linux: Noto Sans CJK JP）
DEF_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
DEF_REG  = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

# フォント自動探索の候補（上から順に最初に存在したものを使う）
BOLD_CANDIDATES = [
    DEF_BOLD,
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKjp-Bold.otf",
    r"C:\Windows\Fonts\NotoSansCJKjp-Bold.otf",
    r"C:\Windows\Fonts\YuGothB.ttc",        # 游ゴシック Bold
    r"C:\Windows\Fonts\meiryob.ttc",        # メイリオ Bold
    r"C:\Windows\Fonts\msgothic.ttc",       # MS ゴシック
]
REG_CANDIDATES = [
    DEF_REG,
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKjp-Regular.otf",
    r"C:\Windows\Fonts\NotoSansCJKjp-Regular.otf",
    r"C:\Windows\Fonts\YuGothR.ttc",        # 游ゴシック
    r"C:\Windows\Fonts\meiryo.ttc",         # メイリオ
    r"C:\Windows\Fonts\msgothic.ttc",
]


def resolve_font(preferred, candidates):
    """指定パスが存在すればそれを、無ければ候補から最初に見つかったものを返す。"""
    if preferred and os.path.exists(preferred):
        return preferred
    for c in candidates:
        if os.path.exists(c):
            return c
    # どれも無ければ Pillow 既定（英字のみ）にフォールバック
    return None


# ---- テーマ配色 ----
# blue = ATAWI FUDOSAN 標準（ロゴブルー #0090D0 基調）。既定値。
# green = 旧・いえらぶ時代のレガシー配色。原則使わない。
THEMES = {
    "blue": {
        "bg":        "#eaf4fb",
        "grad_top":  (234, 244, 251),
        "grad_bot":  (188, 223, 243),
        "hill_far":  (150, 205, 234),
        "hill_near": (116, 186, 223),
        "orbit":     (72, 150, 200),
        "roof":      (0, 144, 208),
        "badge":     (0, 144, 208),
        "house_ol":  (120, 160, 185),
        "text":      (10, 68, 100),
        "sub":       (40, 100, 135),
        "brand":     (60, 95, 120),
    },
    "green": {
        "bg":        "#eef6f0",
        "grad_top":  (238, 246, 240),
        "grad_bot":  (196, 228, 208),
        "hill_far":  (170, 214, 186),
        "hill_near": (150, 202, 172),
        "orbit":     (95, 170, 132),
        "roof":      (82, 163, 122),
        "badge":     (82, 163, 122),
        "house_ol":  (120, 150, 135),
        "text":      (38, 82, 62),
        "sub":       (64, 96, 80),
        "brand":     (70, 90, 80),
    },
}
# 差し色（オレンジ／イエロー）は両テーマ共通
ACCENT = (245, 166, 35)
SUN    = (255, 209, 102)
SUN_GL = (255, 226, 156)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--line1", required=True, help="キャッチコピー1行目")
    ap.add_argument("--line2", default="", help="キャッチコピー2行目")
    ap.add_argument("--sub", default="", help="サブコピー（小さめ）")
    ap.add_argument("--brand", default="磐田市・袋井市の不動産売却｜富士ヶ丘サービス")
    ap.add_argument("--out", default="cover.jpg")
    ap.add_argument("--font", default=DEF_BOLD, help="太字フォントのパス")
    ap.add_argument("--font-regular", default=DEF_REG, help="通常フォントのパス")
    ap.add_argument("--rocket", action="store_true", help="ロケットを描く（宇宙系テーマ向け）")
    ap.add_argument("--theme", choices=["blue", "green"], default="blue",
                    help="配色。blue=ATAWI FUDOSAN標準（既定）／green=旧いえらぶ用レガシー")
    a = ap.parse_args()

    C = THEMES[a.theme]

    bold_path = resolve_font(a.font, BOLD_CANDIDATES)
    reg_path  = resolve_font(a.font_regular, REG_CANDIDATES)

    def fb(s):
        return ImageFont.truetype(bold_path, s) if bold_path else ImageFont.load_default()

    def fr(s):
        return ImageFont.truetype(reg_path, s) if reg_path else ImageFont.load_default()

    # ---- 正方形キャンバス ----
    W, H = 760, 760
    img = Image.new("RGB", (W, H), C["bg"])
    dr = ImageDraw.Draw(img)

    # 背景グラデーション（上→下）
    top, bot = C["grad_top"], C["grad_bot"]
    for y in range(H):
        t = y / H
        dr.line([(0, y), (W, y)], fill=(int(top[0]+(bot[0]-top[0])*t),
                                        int(top[1]+(bot[1]-top[1])*t),
                                        int(top[2]+(bot[2]-top[2])*t)))

    # 下部の丘（2段）
    dr.ellipse([-180, H-150, W+180, H+320], fill=C["hill_far"])
    dr.ellipse([-120, H-90,  W+220, H+360], fill=C["hill_near"])

    # 太陽（右上）＋点線オービット
    sx, sy = W-110, 96
    dr.ellipse([sx-38, sy-38, sx+38, sy+38], fill=SUN)
    for i in range(5):
        dr.ellipse([sx-38-i*4, sy-38-i*4, sx+38+i*4, sy+38+i*4], outline=SUN_GL)
    for deg in range(120, 360, 7):
        rad = math.radians(deg); x = sx+150*math.cos(rad); y = sy+150*math.sin(rad)
        if 30 < x < W-10 and 10 < y < H-220:
            dr.ellipse([x-2, y-2, x+2, y+2], fill=C["orbit"])

    # ロケット（任意）
    if a.rocket:
        rx, ry = W-150, 250
        dr.polygon([(rx, ry-46),(rx+18, ry-6),(rx+18, ry+34),(rx-18, ry+34),(rx-18, ry-6)], fill=(38, 52, 74))
        dr.polygon([(rx, ry-46),(rx+10, ry-18),(rx-10, ry-18)], fill=ACCENT)
        dr.ellipse([rx-9, ry-6, rx+9, ry+12], fill=(140, 201, 255))
        dr.ellipse([rx-9, ry-6, rx+9, ry+12], outline=(255, 255, 255), width=2)
        dr.polygon([(rx-18, ry+14),(rx-34, ry+40),(rx-18, ry+34)], fill=ACCENT)
        dr.polygon([(rx+18, ry+14),(rx+34, ry+40),(rx+18, ry+34)], fill=ACCENT)
        dr.polygon([(rx-9, ry+34),(rx+9, ry+34),(rx, ry+62)], fill=(255, 176, 59))
        dr.polygon([(rx-5, ry+34),(rx+5, ry+34),(rx, ry+50)], fill=(255, 221, 128))

    # 家＋チェックバッジ（右下）
    hx, hy = W-150, H-250
    dr.rectangle([hx-48, hy, hx+48, hy+96], fill=(255, 255, 255), outline=C["house_ol"], width=2)
    dr.polygon([(hx-64, hy),(hx, hy-58),(hx+64, hy)], fill=C["roof"])
    dr.rectangle([hx-14, hy+44, hx+16, hy+96], fill=ACCENT)
    bx, by = hx+56, hy-22
    dr.ellipse([bx-22, by-22, bx+22, by+22], fill=C["badge"])
    dr.line([(bx-10, by),(bx-2, by+9),(bx+12, by-10)], fill=(255, 255, 255), width=5)

    # ---- テキスト（上部）----
    dark = C["text"]
    dr.text((52, 150), a.line1, font=fb(52), fill=dark)
    y2 = 222
    if a.line2:
        dr.text((52, y2), a.line2, font=fb(52), fill=dark)
        bar_y = y2 + 84
    else:
        bar_y = 150 + 84
    # アクセントバー
    dr.rectangle([54, bar_y, 254, bar_y+7], fill=ACCENT)
    if a.sub:
        dr.text((54, bar_y+26), a.sub, font=fb(22), fill=C["sub"])

    # ブランド帯（最下部）
    dr.text((54, H-52), a.brand, font=fr(20), fill=C["brand"])

    img.save(a.out, "JPEG", quality=90)
    print("saved", a.out, img.size, "| theme:", a.theme, "| bold:", bold_path, "| reg:", reg_path)


if __name__ == "__main__":
    main()
