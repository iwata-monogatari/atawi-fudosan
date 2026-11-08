"""Mechanical article, sources and image checks; no browser judgment."""
from pathlib import Path
import json, re, sys, html, hashlib, subprocess
from PIL import Image
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/dedicated-publish'
data=json.loads((ROOT/'data/blog-20261108.json').read_text(encoding='utf-8'))
parser=__import__('argparse').ArgumentParser();parser.add_argument('--shared',action='store_true');args=parser.parse_args()
source_http=json.loads((OUT/'sources-http.json').read_text(encoding='utf-8'))
sources={x['url']:x for x in source_http}
source_results=[];article_results=[];image_results=[];errors=[]
for a in data['articles']:
    slug=a['slug'];rel='blog/'+slug+'/index.html';text=(ROOT/rel).read_text(encoding='utf-8')
    body=re.search(r'<article>(.*?)</article>',text,re.S)[1]
    visible=html.unescape(re.sub('<[^>]+>','',body));length=len(re.sub(r'\s','',visible))
    nodes=[]
    for raw in re.findall('<script type="application/ld\\+json">(.*?)</script>',text,re.S):
        d=json.loads(raw);nodes+=d.get('@graph',[d])
    types=[]
    for node in nodes:types+=node['@type'] if isinstance(node['@type'],list) else [node['@type']]
    required={'BlogPosting','BreadcrumbList','Person','FAQPage'}
    tests={'title_exact':re.search('<h1>(.*?)</h1>',text)[1]==a['title'], 'title_length':len(a['title'])<=32,
           'visible_length_3500_4500':3500<=length<=4500,'answer_under_200':len(a['answer'])<=200,
           'four_jsonld_types':required.issubset(types),'three_faq':len(a['faq'])==3,
           'date':all(x['datePublished']==x['dateModified']=='2026-11-08T09:00:00+09:00' for x in nodes if 'datePublished' in x),
           'author_photo':'/assets/author-oishi.jpg' in body,
           'internal_blog_links_3_5':3<=len(set(re.findall('href="(/blog/[^"#]+/)"',body)))<=5}
    tests['faq_matches']=next(x for x in nodes if x['@type']=='FAQPage')['mainEntity']==[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':ans}} for q,ans in a['faq']]
    tests['h2_self_contained']=all(not html.unescape(re.sub('<[^>]+>','',p)).startswith(('これ','その','上記')) for p in re.findall(r'<h2>.*?</h2>\s*<p>(.*?)</p>',body,re.S))
    paths=[]
    for link in re.findall(r'(?:src|href)="(/[^"#?]*)',text):
        p=ROOT/link.lstrip('/');p=p/'index.html' if link.endswith('/') else p
        paths.append({'url':link,'exists':p.is_file()})
    tests['local_references']=all(x['exists'] for x in paths)
    if args.shared:
        tests['backlink']='/blog/'+slug+'/' in (ROOT/'blog'/a['backlink']/'index.html').read_text(encoding='utf-8')
        for name in ['blog/index.html','sitemap-blog.xml','feed.xml','llms.txt','llms-full.txt']:
            tests['shared_'+name]=slug in (ROOT/name).read_text(encoding='utf-8')
        feed=ET.parse(ROOT/'feed.xml')
        matching=[i for i in feed.findall('./channel/item') if slug in (i.findtext('link') or '')]
        tests['feed_title_date_unique']=len(matching)==1 and matching[0].findtext('title')==a['title'] and '08 Nov 2026' in matching[0].findtext('pubDate')
        sm=ET.parse(ROOT/'sitemap-blog.xml');ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
        matching=[u for u in sm.findall('s:url',ns) if slug in (u.findtext('s:loc',namespaces=ns) or '')]
        tests['sitemap_date_unique']=len(matching)==1 and matching[0].findtext('s:lastmod',namespaces=ns)=='2026-11-08'
    legacy=subprocess.run([sys.executable,str(ROOT/'blog-auto/scripts/validate.py'),str(ROOT/rel)],capture_output=True,text=True,encoding='utf-8',errors='replace')
    (OUT/(slug+'-legacy.txt')).write_text(legacy.stdout+legacy.stderr,encoding='utf-8')
    tests['site_article_validator']=legacy.returncode==0
    article_results.append({'slug':slug,'visible_characters':length,'answer_characters':len(a['answer']),'tests':tests,'legacy_output':legacy.stdout[-600:]})
    errors += [slug+': '+key for key,ok in tests.items() if not ok]
    for label,url,locator in a['sources']:
        row=sources.get(url,{})
        ok=row.get('status')==200 and (ROOT/row.get('file','not-found')).is_file()
        if ok:ok=hashlib.sha256((ROOT/row['file']).read_bytes()).hexdigest()==row['sha256']
        source_results.append({'article':slug,'label':label,'url':url,'locator':locator,'http_200_and_saved_sha':ok})
        if not ok:errors.append(slug+': missing source proof '+url)
    for key,filename in [('cover',a.get('cover_file','cover.jpg')),('figure','figure.svg')]:
        p=ROOT/'blog'/slug/filename;img={'article':slug,'key':key,'path':p.relative_to(ROOT).as_posix(),'exists':p.is_file(),'page_reference':filename in body}
        if key=='cover':img['size']=list(Image.open(p).size);img['size_pass']=img['size']==[760,760]
        else:
            svg=ET.parse(p).getroot();w=float(svg.attrib['viewBox'].split()[2]);sizes=[float(e.attrib['font-size'])*240/w for e in svg.iter() if e.tag.endswith('text')];img['minimum_font_at_240px']=min(sizes);img['readability_precheck_pass']=min(sizes)>=12
        img['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();img['visual_review_required']=True
        image_results.append(img)
        if not all(img[k] for k in ['exists','page_reference']):errors.append(slug+': image '+key)
for name,rows in [('article',article_results),('sources',source_results),('images',image_results)]:
    (OUT/(name+'-check.json')).write_text(json.dumps({'checked_at':'2026-11-08','phase':'shared' if args.shared else 'article','results':rows,'errors':[e for e in errors if name=='article' or ('source' in e if name=='sources' else 'image' in e)]},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'phase':'shared' if args.shared else 'article','articles':[{k:r[k] for k in ['slug','visible_characters']} for r in article_results],'errors':errors},ensure_ascii=False))
sys.exit(bool(errors))
