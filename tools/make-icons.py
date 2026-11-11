# アプリアイコン（スパナ）の PNG を作る: python tools/make-icons.py
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ICONS = Path(__file__).resolve().parent.parent / 'icons'
ICONS.mkdir(exist_ok=True)
S = 1024
TOP = (255, 146, 64)    # 背景のグラデーション（上）
BOTTOM = (226, 82, 12)  # 背景のグラデーション（下）


def background():
    img = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):
        k = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * k) for a, b in zip(TOP, BOTTOM)))
    return img


def wrench_mask(scale=1.0):
    # 横向きに描いてから45度回す。左が口（開いた側）、右が持ち手
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    c = S / 2
    d.rounded_rectangle([c - 150, c - 68, c + 360, c + 68], radius=68, fill=255)  # 持ち手
    d.ellipse([c - 400, c - 190, c - 20, c + 190], fill=255)                      # 頭
    d.rectangle([c - 420, c - 72, c - 210, c + 72], fill=0)                       # 口
    d.ellipse([c - 282, c - 72, c - 138, c + 72], fill=0)                         # 口の奥を丸く
    d.ellipse([c + 250, c - 30, c + 310, c + 30], fill=0)                         # 持ち手の穴
    m = m.rotate(-45, resample=Image.BICUBIC, center=(c, c))
    if scale != 1.0:
        small = m.resize((round(S * scale),) * 2, Image.LANCZOS)
        m = Image.new('L', (S, S), 0)
        m.paste(small, ((S - small.width) // 2,) * 2)
    return m


def icon(scale=1.0):
    img = background()
    mask = wrench_mask(scale)
    shadow = mask.filter(ImageFilter.GaussianBlur(18)).point(lambda v: v * 0.35)
    img.paste((120, 40, 0), (0, 14), shadow)
    img.paste((255, 255, 255), (0, 0), mask)
    return img


def rounded(img):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=round(img.width * 0.225), fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


full = icon()
for size, name in [(180, 'icon-180.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    full.resize((size, size), Image.LANCZOS).save(ICONS / name, optimize=True)
icon(0.78).resize((512, 512), Image.LANCZOS).save(ICONS / 'icon-maskable-512.png', optimize=True)
rounded(full).resize((96, 96), Image.LANCZOS).save(ICONS / 'favicon.png', optimize=True)
