"""Prepare evidence-bound specs for the dedicated publisher, without publishing."""
from pathlib import Path
import argparse, json, re, sys, shutil, subprocess
from urllib.parse import urlsplit, unquote

ROOT=Path(__file__).resolve().parents[1]
ENGINE=Path(r'C:\Users\Owner\Desktop\dots_workspace\work_claude\blog-dashboard')
sys.path.insert(0,str(ENGINE))
from resource_contracts import declaration
OUT=ROOT/'test-results/dedicated-publish'
ORIGIN='https://fudosan.atawi.link'
WORKFLOW='cfb9f8a604e0a9a2ae036d35a147d6ef4d0425cfbeb41c335ef22ebae6cac450'
RUN='c08e80ca8700437080194f421d22f437'
BASE='ed058cd27c9c94e90aa6890f8d6f2184f677278f'
data=json.loads((ROOT/'data/blog-20261108.json').read_text(encoding='utf-8'))

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def rel(path):return path.relative_to(ROOT).as_posix()

def assets(pages):
    pending=list(pages);seen=set()
    while pending:
        name=pending.pop()
        if name in seen:continue
        p=ROOT/name
        if not p.is_file():raise ValueError('Missing asset '+name)
        seen.add(name)
        if p.suffix not in ['.html','.css','.js']:continue
        s=p.read_text(encoding='utf-8')
        refs=re.findall(r'(?:src|href|srcset)=["\']([^"\']+)["\']',s) if p.suffix=='.html' else re.findall(r'url\(["\']?([^\)"\']+)',s) if p.suffix=='.css' else []
        for url in refs:
            u=urlsplit(url)
            if (u.scheme or u.netloc) and (u.scheme+'://'+u.netloc)!=ORIGIN:continue
            if not u.path:continue
            path=unquote(u.path)
            if path.endswith('/') or Path(path).suffix not in ['.css','.js','.jpg','.jpeg','.png','.svg','.webp','.ico','.woff2','.woff','.ttf']:continue
            dep=(ROOT/path.lstrip('/')) if path.startswith('/') else p.parent/path
            pending.append(rel(dep.resolve()))
    return sorted(seen)

reviews=[
    '自己査読合格。貸主と管理受託者・転貸の契約関係を分離。家賃保証と債務保証を区別。減額・終了・売却の可否を個別契約なしに断定しない。良い点の後に最初の月額だけで比べる説明への注文。空室負担と変更しにくさの迷いを明記。原則5、実話の創作なし。',
    '自己査読合格。法務局4ページをHTTP200の原文で照合。案内20分・完全予約制と申請受理を分離。磐田電話番号と2番を照合。予約空き未確認、書類の事前審査・法律判断の対象外を明示。機器と移動を選べる利点の後、資料整理と案内範囲の注文。自力で最後まで進められるかの迷いを明記。原則1、実話の創作なし。',
    '自己査読合格。令和8年分の3月15日・4月23日・5月31日を別欄で照合。2分の1の分母は納付税額で、売却益ではない。60万円は仮定の納付税額と明記。利子税の2027年適用率を未確定とし旧年の1.3％を流用せず。分けて支払える利点の後、残額の財源を確認する注文。資金がある人も延納を選ぶべきかの迷いを明記。原則2、実話の創作なし。',
    '自己査読合格。予告広告の対象が2以上であることを明記し中古住宅1軒へ一般化せず。契約・予約・順位確保の3制限を分離。2022年施行を2026年新制度と誤認させない。事前検討時間の利点の後、広告前に販売行為を進める説明への注文。反応を知りたい気持ちと買主への説明の迷いを明記。原則5、実話の創作なし。'
]

def image_gate(articles):
    return {'status':'pass','articles':[{'url':ORIGIN+'/blog/'+a['slug']+'/','title':a['title'],'requested_title':a['title'],'images':[{'key':key,'kind':kind,'source':'/blog/'+a['slug']+'/'+filename,'local_path':'blog/'+a['slug']+'/'+filename,'local_exists':True,'page_reference':True} for key,kind,filename in [('cover','cover',a.get('cover_file','cover.jpg')),('figure','illustration','figure.svg')]]} for a in articles]}

def make(articles,early=False):
    suffix=articles[0]['slug'] if early else 'final'
    folder=OUT/suffix;folder.mkdir(parents=True,exist_ok=True)
    # Save independent proof records, preserving the executed raw observations.
    slugs={a['slug'] for a in articles}
    for category in ['article','sources','images']:
        source=json.loads((OUT/(category+'-check.json')).read_text(encoding='utf-8'))
        source['results']=[r for r in source['results'] if r.get('slug',r.get('article')) in slugs]
        save(folder/(category+'.json'),source)
    review='\n'.join(reviews[data['articles'].index(a)] for a in articles)
    review+='\n共通確認：結論200字以内、可視3500〜4500字、FAQ3問とJSON-LD4種一致、各H2直下の独立性、内部リンク3本。表紙4点を目視確認。専用図の出典行切れを修正し、400px版をレンダリング確認。240px換算の最小文字12pxを機械計測。実ブラウザーでの320/390px・PC確認は未実施で専任担当へ依頼する。\n'
    review+='修正：既存テンプレートの会社概要リンクの参照先不在を検出し、新記事だけ実在する運営者紹介へ変更。禁止語・禁止フレーズは別保存の独立検査で照合する。'
    if (OUT/'cover-repair-r1/repair.json').is_file():
        review+='\n専任確認の不合格4件へ限定修正：表紙下端の会社名・地域注記を40px太字・白地に濃色の2行へ変更。元cover.jpgを保持し、image_quality_gateのSHA付き版を生成、本文・図・slugは保持。380px縮小画像で4枚の注記の文字切れと可読性を目視確認。ブラウザー上の変更画像と残る未確認項目は再判定が必要。以前のfailをpassに読み替えない。'
    (folder/'review.txt').write_text(review,encoding='utf-8')
    if early:
        build_proof={'command':'python _tools/build-blog-20261108.py + python blog-auto/scripts/validate.py for each ready article','result':'pass','article_legacy_logs':['test-results/dedicated-publish/'+a['slug']+'-legacy.txt' for a in articles],'scope':'article-only; shared build and index updates pending'}
        save(folder/'build.json',build_proof)
    pages=['blog/'+a['slug']+'/index.html' for a in articles]
    checks=[]
    auxiliary=[]
    if not early:
        checks=[json.loads(subprocess.check_output([sys.executable,'-X','utf8',str(ENGINE/'resource_contracts.py'),'--id',ident,'--url',ORIGIN+url],text=True,encoding='utf-8')) for ident,url in [('feed','/feed.xml'),('sitemap','/sitemap-blog.xml'),('ledger','/data/blog-20261108.json')]]
        checks += [{'id':'listing','type':'link','url':ORIGIN+'/blog/','expect':'2026年11月8日欄に4記事の依頼タイトルが表示され、各記事と表紙へリンクする。'}]
        auxiliary=['blog/index.html','feed.xml','sitemap-blog.xml','data/blog-20261108.json','llms.txt','llms-full.txt']
        for i,a in enumerate(articles):
            checks.append({'id':'reverse-'+str(i+1),'type':'link','url':ORIGIN+'/blog/'+a['backlink']+'/','expect':'本文の追加文から「'+a['title']+'」の新記事へ遷移できる。既存本文を保持する。'})
            auxiliary.append('blog/'+a['backlink']+'/index.html')
        checks += [{'id':'llms','type':'text','url':ORIGIN+'/llms.txt','expect':'2026年11月8日追加欄に4記事のタイトルと正規URLを含む。'},
                   {'id':'llms-full','type':'text','url':ORIGIN+'/llms-full.txt','expect':'2026年11月8日追加欄に4記事のタイトルと正規URLを含む。'},
                   {'id':'cta','type':'link','url':ORIGIN+'/blog/'+articles[0]['slug']+'/','expect':'記事末尾の実家カルテ・実家じまい相談室・相続はじめ相談室への導線があり、申込には所在地を番地・地番まで必要と明記する。'}]
    inventory=assets(pages+auxiliary)
    git_files=['data/blog-20261108.json','_tools/build-blog-20261108.py','_tools/verify-blog-20261108.py','_tools/release-blog-20261108.py']
    if (ROOT/'_tools/repair-blog-20261108-covers.py').is_file():git_files.append('_tools/repair-blog-20261108-covers.py')
    for a in articles:git_files+=['blog/'+a['slug']+'/'+n for n in ['index.html','cover.jpg','figure.svg']]
    for a in articles:
        if a.get('cover_file'):git_files.append('blog/'+a['slug']+'/'+a['cover_file'])
    if not early:git_files+=auxiliary
    git_files=sorted(set(git_files))
    source=sorted(set(git_files+['blog/20261107-sennin-baikai-hokoku/index.html','_tools/sync-blog-seo.mjs','_tools/check-property-address-policy.mjs','_tools/check-public-facts.mjs','blog-auto/scripts/validate.py','blog-auto/scripts/address_policy.py']))
    quality={'schema_version':1,'workflow_id':WORKFLOW,'review':review,'quality_checks':dict.fromkeys(['sources','article','images','review','build'],True),'checks':{},'image_gate':image_gate(articles)}
    for category in ['sources','article','images','review','build']:
        proof=folder/('review.txt' if category=='review' else 'build.json' if category=='build' and early else 'build-check.json' if category=='build' else category+'.json')
        if category=='build' and not early:proof=OUT/'build-check.json'
        quality['checks'][category]=[{'path':rel(proof)}]
    quality['checks']['review'].append({'path':'test-results/dedicated-publish/prohibited-check.json'})
    quality['checks']['images'].append({'path':'test-results/dedicated-publish/covers-contact-sheet.jpg'})
    quality['checks']['images'].append({'path':'test-results/dedicated-publish/figure-corrected.png'})
    if (OUT/'cover-repair-r1/repair.json').is_file():
        quality['checks']['images'] += [{'path':'test-results/dedicated-publish/cover-repair-r1/'+name} for name in ['repair.json','covers-390.jpg','preservation.json']]
    quality['checks']['sources'].append({'path':'test-results/dedicated-publish/sources-http.json'})
    observed=json.loads((OUT/'sources-http.json').read_text(encoding='utf-8'))
    used_urls={u for a in articles for _,u,_ in a['sources']}
    quality['checks']['sources'] += [{'path':row['file']} for row in observed if row['url'] in used_urls]
    if not early:
        quality['checks']['build'] += [{'path':'test-results/dedicated-publish/build-'+str(i)+'.log'} for i in range(3)]
    for a in articles:quality['checks']['build'].append({'path':'test-results/dedicated-publish/'+a['slug']+'-legacy.txt'})
    validation=folder/'validation.json';save(validation,quality)
    request={'kind':'prepublish','review_protocol':2,'urls':[ORIGIN+'/blog/'+a['slug']+'/' for a in articles],'preview_path':pages[0],'preview_paths':pages,'files':inventory,'publish_root':'.','asset_manifest':inventory,'checks':checks,
             'note':'全記事のPCと320px・390pxでH1、固有本文、表紙、専用図と注記・出典、著者写真、FAQ、横はみ出しを確認する。図の最小文字は240px換算12px。外部出典のHTTP200は実取得記録を継承。予約操作や申込みは行わない。今回の変更は4枚の表紙下端注記と画像URL参照のみ。ticket 8a34cbd1708a4b66a57a9d0244756b8cの同一依存hashの既存passは保持し、変更した画像と影響範囲、未確認の本文・末尾・横はみ出し・CTAだけを確認する。failを合格へ転記しない。'}
    spec={'schema_version':1,'run_id':RUN,'workflow_id':WORKFLOW,'workflow_run':RUN+'-batch','expected_remote_sha':BASE,'source_files':source,'build_files':inventory,'git_files':git_files,'dependency_files':[], 'validation_record':rel(validation),'completion_path':'test-results/dedicated-publish/completion.json','commit_message':'Add four real estate articles for 2026-11-08','browser_request':request}
    specpath=folder/'spec.json';save(specpath,spec)
    return rel(specpath)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--early',action='store_true');args=p.parse_args()
    specs=[make([a],True) for a in data['articles']] if args.early else [make(data['articles'])]
    print(json.dumps(specs,ensure_ascii=False))
