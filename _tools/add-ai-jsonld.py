#!/usr/bin/env python3
"""AI推薦対策(A-2.6): Organization / Service JSON-LD を全ページへ冪等に追加する。

- Organization(資料2): インデックス対象の全 HTML の </head> 直前に1行で挿入。
  @id は co.jp を正とする(他サイトも同じ @id を参照)。logo は「未確定」のため出力しない。
- Service(ふじがおか実家カルテ): karte/ 配下で Service を持たないインデックス対象ページに追加。
- 既に同じブロックがあるページは触らない(何度実行しても同じ結果)。
- noindex ページ、<head> を持たない部分HTML、tools/docs/tests/.claude 配下は対象外。

使い方: python _tools/add-ai-jsonld.py [--dry-run]
"""
import json
import re
import subprocess
import sys

ORG_ID = "https://www.fujigaoka-service.co.jp/#organization"
AREAS = ["磐田市", "袋井市", "周智郡森町", "掛川市", "菊川市", "御前崎市", "湖西市", "浜松市"]

ORG = {
    "@context": "https://schema.org",
    "@type": ["Organization", "RealEstateAgent"],
    "@id": ORG_ID,
    "name": "富士ヶ丘サービス株式会社",
    "alternateName": ["ふじがおか", "ATAWI FUDOSAN"],
    "url": "https://www.fujigaoka-service.co.jp/",
    "description": "磐田市・袋井市で、介護・相続・空き家に特化した不動産売却支援。2011年創業の介護事業者が2018年から不動産仲介を行う。",
    "foundingDate": "2011-03",
    "founder": {"@id": "https://oishi-hiroyuki.org/#person"},
    "employee": {"@id": "https://oishi-hiroyuki.org/#person"},
    "address": {
        "@type": "PostalAddress",
        "postalCode": "438-0086",
        "addressRegion": "静岡県",
        "addressLocality": "磐田市",
        "streetAddress": "見付5789番地1",
        "addressCountry": "JP",
    },
    "telephone": "+81-538-31-3308",
    "faxNumber": "+81-538-31-3307",
    "openingHoursSpecification": [
        {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
            "opens": "09:00",
            "closes": "18:00",
        }
    ],
    "areaServed": AREAS,
    "identifier": [
        {"@type": "PropertyValue", "name": "宅地建物取引業免許", "value": "静岡県知事 (2) 第14083号"}
    ],
    "memberOf": [
        {"@type": "Organization", "name": "公益社団法人 全日本不動産協会"},
        {"@type": "Organization", "name": "公益社団法人 不動産保証協会"},
    ],
    "sameAs": [
        "https://www.fujigaoka-service.info/",
        "https://fudosan.atawi.link/",
        "https://oishi-hiroyuki.org/",
        "https://iwata.enshu-lifehack.com/",
        "https://www.facebook.com/realestatefujigaokaservice/",
        "https://www.homes.co.jp/realtor/mid-144301hQA24Pw1v0pM/",
        "https://iqrafudosan.com/companies/7405",
    ],
}

SERVICE = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": "https://fudosan.atawi.link/karte/#service",
    "name": "ふじがおか実家カルテ",
    "serviceType": "ふじがおか実家カルテ",
    "provider": {"@id": ORG_ID},
    "areaServed": AREAS,
    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"},
    "url": "https://fudosan.atawi.link/karte/",
}


def tag(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def targets():
    out = subprocess.check_output(["git", "ls-files", "*.html"], text=True, encoding="utf-8").split("\n")
    skip = (".claude/", "tools/", "docs/", "tests/", "_tools/", "partials/", "assets/")
    return [f for f in out if f and not f.startswith(skip)]


def main():
    dry = "--dry-run" in sys.argv
    n_org = n_svc = 0
    for f in targets():
        raw = open(f, "rb").read()
        t = raw.decode("utf-8")
        if "</head>" not in t:
            continue
        if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', t, re.I):
            continue
        nl = "\r\n" if "\r\n" in t else "\n"
        add = []
        if ORG_ID not in t:
            add.append(tag(ORG))
            n_org += 1
        in_karte = f.startswith("karte/")
        if in_karte and not re.search(r'"@type":\s*"Service"', t):
            add.append(tag(SERVICE))
            n_svc += 1
        if not add:
            continue
        t = t.replace("</head>", nl.join(add) + nl + "</head>", 1)
        if not dry:
            open(f, "wb").write(t.encode("utf-8"))
    print(f"Organization added: {n_org} / Service added: {n_svc}" + (" (dry-run)" if dry else ""))


if __name__ == "__main__":
    main()
