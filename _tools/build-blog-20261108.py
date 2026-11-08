"""Build the four 2026-11-08 articles from their reviewed editorial source.

The base is the preceding day's published page. Shared changes are idempotent;
existing article text is preserved except for one explicit contextual backlink.
"""
from pathlib import Path
import html
import json
import re
import xml.etree.ElementTree as ET
from email.utils import format_datetime
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/blog-20261108.json'
BASE = ROOT / 'blog/20261107-sennin-baikai-hokoku/index.html'
ORIGIN = 'https://fudosan.atawi.link'
STAMP = '2026-11-08T09:00:00+09:00'
REPORT = ROOT / 'test-results/dedicated-publish'

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding='utf-8', newline='\n')

def esc(value):
    return html.escape(value, quote=True)

def make_figure(a):
    # Every visible glyph is >=20px at width400, hence >=12px at width240.
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" role="img" aria-labelledby="t d">',
             '<title id="t">'+esc(a['figure_title'])+'</title>',
             '<desc id="d">'+esc('。'.join(x+'：'+y for x,y in a['figure_rows']))+'</desc>',
             '<rect width="400" height="600" rx="18" fill="#f2f9fe"/>',
             '<text x="24" y="44" font-family="Yu Gothic,Meiryo,sans-serif" font-size="25" font-weight="bold" fill="#0e5c8a">'+esc(a['figure_title'])+'</text>']
    for i,(title,detail) in enumerate(a['figure_rows']):
        y=72+i*126
        lines += [f'<rect x="20" y="{y}" width="360" height="108" rx="12" fill="#fff" stroke="#2e9bd4"/>',
                  f'<text x="36" y="{y+36}" font-family="Yu Gothic,Meiryo,sans-serif" font-size="24" font-weight="bold" fill="#0e5c8a">{esc(title)}</text>',
                  f'<text x="36" y="{y+76}" font-family="Yu Gothic,Meiryo,sans-serif" font-size="20" fill="#1e3f55">{esc(detail)}</text>']
        if i<2:lines.append(f'<path d="M200 {y+111}v12m-5-5 5 5 5-5" fill="none" stroke="#16709f" stroke-width="2"/>')
    notes = (['振替納税は振替日が基準','延納には利子税もかかる'] if a['intent']=='do' else
             ['個別の条件は別途確認','予約の空き状況は未確認'] if a['intent']=='local' else
             ['個別の契約条件は','契約書と専門家へ確認'] if a['intent']=='compare' else
             ['個別の広告案は','担当窓口や専門家へ確認'])
    for i,line in enumerate(notes):lines.append(f'<text x="24" y="{482+i*28}" font-family="Yu Gothic,Meiryo,sans-serif" font-size="20" fill="#1e3f55">{esc(line)}</text>')
    source='国税庁' if a['intent']=='do' else '法務局' if a['intent']=='local' else '国土交通省' if a['intent']=='compare' else '首都圏不動産公取協'
    lines.append(f'<text x="24" y="552" font-family="Yu Gothic,Meiryo,sans-serif" font-size="20" fill="#4e7288">出典：{source}</text><text x="24" y="582" font-family="Yu Gothic,Meiryo,sans-serif" font-size="20" fill="#4e7288">2026年11月確認</text></svg>')
    return '\n'.join(lines)

def build_articles(data):
    template = BASE.read_text(encoding='utf-8')
    style = re.search(r'<style>.*?</style>', template, re.S)[0]
    header = re.search(r'<header class="site-global-header">.*?</header>',template,re.S)[0]
    author = re.search(r'<div class="author-box">.*?</div></div>', template,re.S)[0]
    author = author.replace('</div></div>','<p>執筆：大石浩之（宅地建物取引士・代表取締役）</p></div></div>')
    cta = re.search(r'<div class="blog-common-cta.*?</div>', template,re.S)[0]
    footer = re.search(r'<footer class="site">.*?</footer>',template,re.S)[0].replace('href="/about/">会社概要','href="/about/oishi/">運営者紹介')
    analytics = template[template.index('<!-- Google tag'):template.index('</head>')] if '<!-- Google tag' in template else ''
    if not analytics:
        analytics = '<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18409604033"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","AW-18409604033");</script>'
    plans=[]
    for a in data['articles']:
        slug=a['slug'];url=ORIGIN+'/blog/'+slug+'/'
        person={'@type':'Person','@id':'https://oishi-hiroyuki.org/#person','name':'大石浩之','jobTitle':'不動産業・宅地建物取引士','image':ORIGIN+'/assets/author-oishi.jpg','url':'https://oishi-hiroyuki.org/profile','sameAs':['https://fudosan.atawi.link/#oishi','https://oishi-hiroyuki.org/profile','https://morimachi.enshu-lifehack.com/']}
        graph=[{'@type':['BlogPosting','Article'],'headline':a['title'],'description':a['description'],'datePublished':STAMP,'dateModified':STAMP,'author':{'@id':person['@id']},'image':[url+'cover.jpg',url+'figure.svg'],'url':url,'mainEntityOfPage':url,'inLanguage':'ja'},person,
               {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'ホーム','item':ORIGIN+'/'},{'@type':'ListItem','position':2,'name':'ブログ','item':ORIGIN+'/blog/'},{'@type':'ListItem','position':3,'name':a['title'],'item':url}]},
               {'@type':'FAQPage','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':ans}} for q,ans in a['faq']]}]
        head=f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(a["title"])}｜ATAWI FUDOSAN</title><meta name="description" content="{esc(a["description"])}"><link rel="canonical" href="{url}"><link rel="stylesheet" href="/assets/site-header.css?v=20261010-mobile"><meta property="og:type" content="article"><meta property="og:title" content="{esc(a["title"])}"><meta property="og:description" content="{esc(a["description"])}"><meta property="og:url" content="{url}"><meta property="og:image" content="{url}cover.jpg"><meta property="og:site_name" content="ATAWI FUDOSAN"><meta property="article:published_time" content="{STAMP}"><meta property="article:modified_time" content="{STAMP}"><meta name="twitter:card" content="summary_large_image">'+style+'<script type="application/ld+json">'+json.dumps({'@context':'https://schema.org','@graph':graph},ensure_ascii=False)+'</script>'+analytics+'</head>'
        body=header+f'<main class="wrap"><nav aria-label="パンくず"><a href="/">ホーム</a> ／ <a href="/blog/">不動産ブログ</a> ／ {esc(a["title"])}</nav><article><h1>{esc(a["title"])}</h1><p class="date"><time datetime="2026-11-08">2026年11月8日</time>｜カテゴリ：{esc(a["category"])}</p><p class="cover"><img src="/blog/{slug}/cover.jpg" width="760" height="760" alt="{esc(a["title"])}。{esc('、'.join(a['cover']))}と記した青色の表紙"></p><aside class="point-box"><p class="k">この記事の要点</p><p class="q">Q：{esc(a["q"])}</p><p class="a">A：{esc(a["answer"])}</p></aside>'
        for i,(heading,paras) in enumerate(a['sections']):
            body+='<h2>'+esc(heading)+'</h2>\n'+'\n'.join('<p>'+p.replace("href='",'href="').replace("/'>",'/">')+'</p>' for p in paras)
            if i==0:
                alt=a['figure_title']+'。'+'。'.join(x+'は'+y for x,y in a['figure_rows'])+'。個別条件は担当窓口や専門家へ確認する。'
                body+=f'<figure class="editorial-figure"><img src="/blog/{slug}/figure.svg" width="400" height="600" alt="{esc(alt)}" loading="lazy"><figcaption>公式資料をもとに大石浩之が作成。比較・準備の項目を示す図で、個別の結果を保証するものではありません。</figcaption></figure>'
        body+='<section class="faq-box"><h2>よくある質問</h2><p>一般的な仕組みと、ご自身の契約や手続きを分けて確認してください。</p><dl>'+''.join('<dt>'+esc(q)+'</dt><dd>'+esc(ans)+'</dd>' for q,ans in a['faq'])+'</dl></section>'+author+cta
        body+='<section class="src-list"><h2>参考にした公式情報</h2><p>2026年11月8日確認（2026年11月確認）。公表日・更新日と今回の確認日は区別しています。</p><ul>'+''.join('<li><a href="'+esc(u)+'">'+esc(name)+'</a>：'+esc(note)+'</li>' for name,u,note in a['sources'])+'</ul></section><p class="disc">本記事は2026年11月8日に確認した一般的な情報です。制度・様式・受付条件・数値は変わる場合があります。個別の契約、税務・登記・相続の判断は、担当窓口と各分野の専門家に確認してください。</p>'
        # The existing static validator requires this exact description of the company.
        body=body.replace('富士ヶ丘サービス株式会社。介護と不動産を一体で相談し、','介護施設の運営から不動産事業を始めた富士ヶ丘サービスのような、地域密着の会社への相談も選択肢です。介護と不動産を一体で相談し、')
        result=head+'<body>'+body+'</article></main>'+footer+'<script defer src="/assets/ai-referral.js?v=20260723"></script><script defer src="https://fujigaoka-analytics-worker.hiroyukio0122.workers.dev/tracker.js" data-site="atawi-fudosan"></script></body></html>\n'
        result=result.replace('/'+slug+'/cover.jpg','/'+slug+'/'+a.get('cover_file','cover.jpg'))
        write(ROOT/f'blog/{slug}/index.html',result)
        write(ROOT/f'blog/{slug}/figure.svg',make_figure(a))
        plans.append({k:a[k] for k in ['slug','title','query','intent','principles','exp','q','answer','links','backlink','faq'] } | {'h2':[h for h,_ in a['sections']],'memo':'空欄。記載した原則1つを使用。','voice':'体験素材なし。実話の場面を作らず意見として記述。','claim_paragraph':next(p for _,ps in a['sections'] for p in ps if p.startswith('私は、')),'image_role':'表紙と記事専用の縦配置による比較・手順図。','sources':a['sources']})
    write(REPORT/'design.json',json.dumps(plans,ensure_ascii=False,indent=2))

def shared(data):
    articles=data['articles']
    for a in articles:
        path=ROOT/'blog'/a['backlink']/'index.html';s=path.read_text(encoding='utf-8')
        marker='<!-- contextual-link-20261108-'+a['slug']+' -->'
        sentences={
            'compare':f'貸し方を選ぶ段階では、<a href="/blog/{a["slug"]}/">{esc(a["title"])}</a>で家賃変更・終了条件・将来の売却を分けて確認できます。',
            'local':f'法務局の案内を利用する場合は、<a href="/blog/{a["slug"]}/">{esc(a["title"])}</a>で質問と資料を先に整理できます。',
            'do':f'申告後の納付資金は、<a href="/blog/{a["slug"]}/">{esc(a["title"])}</a>で納期限と先に用意する額を確認できます。',
            'know':f'複数区画の販売前に広告を検討する場合は、<a href="/blog/{a["slug"]}/">{esc(a["title"])}</a>で本広告前の対応を確認できます。'
        }
        link=marker+'<p>'+sentences[a['intent']]+'</p>\n'
        if marker in s:
            write(path,re.sub(re.escape(marker)+r'<p>.*?</p>\s*',lambda m:link,s,count=1,flags=re.S))
            continue
        if marker not in s:
            # Insert inside the existing article, immediately before its final body section.
            at=s.find('<h2',s.find('<h2')+1)
            if at<0:raise ValueError('No contextual insertion point: '+a['backlink'])
            write(path,s[:at]+link+s[at:])
    path=ROOT/'blog/index.html';s=path.read_text(encoding='utf-8')
    marker='<!-- entries-20261108 -->'
    if marker not in s:
        entries='\n'+marker+'\n'+''.join(f'<li><a href="/blog/{a["slug"]}/"><img class="thumb" src="/blog/{a["slug"]}/cover.jpg" width="88" height="88" alt="{esc(a["title"])}の表紙"></a><div><p class="e-date">2026年11月8日</p><p class="e-title"><a href="/blog/{a["slug"]}/">{esc(a["title"])}</a></p><p class="e-desc">{esc(a["description"])}</p></div></li>\n' for a in articles)
        for a in articles:entries=entries.replace('/'+a['slug']+'/cover.jpg','/'+a['slug']+'/'+a.get('cover_file','cover.jpg'))
        write(path,s.replace('<h2 class="ym" id="blog-2026-11">2026年11月</h2><ul class="entries">','<h2 class="ym" id="blog-2026-11">2026年11月</h2><ul class="entries">'+entries,1))
    items=[]
    for a in articles:
        url=ORIGIN+'/blog/'+a['slug']+'/'
        items.append('<item><title>'+esc(a['title'])+'</title><link>'+url+'</link><guid isPermaLink="true">'+url+'</guid><pubDate>'+format_datetime(datetime.fromisoformat(STAMP))+'</pubDate><description>'+esc(a['description'])+'</description></item>')
    path=ROOT/'feed.xml';s=path.read_text(encoding='utf-8')
    for a in articles:
        s=re.sub(r'<item>\s*<title>.*?</item>',lambda m:'' if a['slug'] in m[0] else m[0],s,flags=re.S)
    at=s.find('<item>');write(path,s[:at]+'\n'.join(items)+'\n'+s[at:])
    block='## 2026年11月8日追加\n\n'+''.join(f'- [{a["title"]}]({ORIGIN}/blog/{a["slug"]}/) — 2026-11-08。{a["description"]}\n' for a in articles)+'\n'
    for name in ['llms.txt','llms-full.txt']:
        path=ROOT/name;s=path.read_text(encoding='utf-8')
        if '## 2026年11月8日追加' not in s:write(path,block+s)

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--shared',action='store_true');args=p.parse_args()
    data=json.loads(DATA.read_text(encoding='utf-8'))
    if args.shared:shared(data)
    else:build_articles(data)
    print('Built shared updates' if args.shared else 'Built 4 articles and 4 original SVG figures')
