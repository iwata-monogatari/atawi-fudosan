#!/usr/bin/env python3
"""全 HTML の JSON-LD を json.loads で検査し、種別を集計する。"""
import json, re, subprocess, collections, sys
files = subprocess.check_output(["git", "ls-files", "*.html"], text=True, encoding="utf-8").split("\n")
types = collections.Counter(); errs = []; nblocks = 0
for f in filter(None, files):
    if f.startswith((".claude/",)):
        continue
    t = open(f, encoding="utf-8", errors="replace").read()
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        nblocks += 1
        try:
            d = json.loads(m.group(1))
        except Exception as e:
            errs.append((f, str(e))); continue
        objs = d if isinstance(d, list) else d.get("@graph", [d]) if isinstance(d, dict) else []
        for o in objs:
            ty = o.get("@type")
            types[",".join(ty) if isinstance(ty, list) else str(ty)] += 1
print("blocks", nblocks, "errors", len(errs))
for e in errs[:20]: print(e)
for k, v in types.most_common(): print(v, k)
sys.exit(1 if errs else 0)
