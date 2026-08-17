#!/usr/bin/env python3
# 実機スクリーンショットから LP 用の画像を切り出す。
#   python3 make-images.py
# 入力: ../../mobile/rindo-finder/docs/screenshots/*.png（読むだけ）
# 出力: assets/hero-map.jpg / assets/evidence.png / assets/search.png
# 手で加工しない。切り出す位置をここに書いて、いつでも同じものを作り直せるようにしておく。
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "mobile", "rindo-finder", "docs", "screenshots")
OUT = os.path.join(HERE, "assets")


def load(name):
    return Image.open(os.path.join(SRC, name)).convert("RGB")


def save_png(im, name, colors=192):
    p = im.convert("RGB").quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    path = os.path.join(OUT, name)
    p.save(path, optimize=True)
    return path


def save_jpg(im, name, q=80):
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
    return path


jobs = []

# 1. ヒーローの地図帯。上野村〜秩父多摩甲斐のあたり。
#    ステータスバー・ノッチ・上部のボタン（ダートだけ／検索／地域）は切り落として、
#    線と地形だけが残る横長の帯にする。
m = load("01-map.png").crop((0, 420, 1320, 1060)).resize((1200, 582), Image.LANCZOS)
jobs.append(save_jpg(m, "hero-map.jpg", 80))

# 2. 根拠カード。見出し「根拠（3件中、最新の1件）」からカードの下端まで。
#    本文と同じ大きさで読める倍率にする（縮めない）。
e = load("06-public.png").crop((28, 1900, 1292, 2536)).resize((948, 477), Image.LANCZOS)
jobs.append(save_png(e, "evidence.png", 128))

# 3. 検索の一覧。路線名・県・規制の語・「◯日前」が並ぶところ。
#    圏外でもこれだけの情報が端末の中から出る、という節で使う。
s = load("04-search.png").crop((0, 800, 1320, 1424)).resize((900, 425), Image.LANCZOS)
jobs.append(save_png(s, "search.png", 128))

for p in jobs:
    print(f"{os.path.basename(p):16s} {os.path.getsize(p)/1024:7.1f} KB  {Image.open(p).size}")
