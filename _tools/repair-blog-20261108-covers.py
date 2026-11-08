"""Regenerate only the four cover footers and bind new immutable image URLs.

The site's original generator is read-only. Original cover.jpg files, article
prose, figures and canonical URLs are retained.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, subprocess, sys, re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/dedicated-publish/cover-repair-r1'
ORIGINAL=Path(r'C:\Users\Owner\Desktop\dots_workspace\大石端末\00大石制作物\000実家じまい相続はじめ（改\03ブログスキル\scripts\make_cover_square.py')
HELPER=Path(r'C:\Users\Owner\Desktop\dots_workspace\work_claude\blog-dashboard\image_quality_gate.py')

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    datafile=ROOT/'data/blog-20261108.json'
    raw=datafile.read_text(encoding='utf-8');data=json.loads(raw)
    source=ORIGINAL.read_text(encoding='utf-8')
    needle='    dr.text((54, H-52), a.brand, font=fr(20), fill=C["brand"])'
    replacement='''    dr.rounded_rectangle((32, 630, 728, 748), radius=14, fill=(255, 255, 255))
    dr.text((54, 638), "磐田市・袋井市の不動産売却", font=fb(40), fill=(14, 60, 85))
    dr.text((54, 692), "富士ヶ丘サービス", font=fb(40), fill=(14, 60, 85))'''
    if source.count(needle)!=1:raise ValueError('Original cover generator footer differs; no replacement performed')
    program=source.replace(needle,replacement)
    rows=[]
    for a in data['articles']:
        slug=a['slug'];old=ROOT/'blog'/slug/'cover.jpg';before=sha(old)
        candidate=OUT/(slug+'.jpg')
        sys.argv=[str(ORIGINAL),'--line1',a['cover'][0],'--line2',a['cover'][1],'--sub','磐田・袋井｜大石浩之','--out',str(candidate)]
        exec(compile(program,str(ORIGINAL),'exec'),{'__name__':'__main__','__file__':str(ORIGINAL)})
        result=json.loads(subprocess.check_output([sys.executable,'-B','-X','utf8',str(HELPER),'--repo',str(ROOT),'--version',candidate.relative_to(ROOT).as_posix()],text=True,encoding='utf-8'))
        final=ROOT/'blog'/slug/('cover-readable-r1-'+result['sha256'][:12]+'.jpg')
        if final.exists() and sha(final)!=result['sha256']:raise ValueError('Versioned image collision')
        if not final.exists():final.write_bytes((ROOT/result['versioned']).read_bytes())
        assert sha(old)==before
        original=Image.open(old).convert('RGB');new=Image.open(final).convert('RGB')
        # JPEG recompression may alter edge pixels; the generator edits only its footer draw call.
        rows.append({'slug':slug,'original':old.relative_to(ROOT).as_posix(),'original_sha256':before,'versioned':final.relative_to(ROOT).as_posix(),'sha256':sha(final),'helper_result':result,'footer_font_px':40,'footer_font_at_240px':40*240/760,'footer_color':'#0e3c55','footer_background':'#ffffff','size':list(new.size),'change_scope':'original generator footer drawing only','canonical_unchanged':True})
        newname=final.name
        # Replace only the filename token, including JSON-LD and OGP image references.
        path=ROOT/'blog'/slug/'index.html';text=path.read_text(encoding='utf-8')
        oldname=a.get('cover_file','cover.jpg')
        text=text.replace('/'+slug+'/'+oldname,'/'+slug+'/'+newname)
        path.write_text(text,encoding='utf-8',newline='\n')
        listing=ROOT/'blog/index.html';text=listing.read_text(encoding='utf-8')
        text=text.replace('/'+slug+'/'+oldname,'/'+slug+'/'+newname);listing.write_text(text,encoding='utf-8',newline='\n')
        if 'cover_file' not in a:
            pattern=r'("slug": "'+re.escape(slug)+r'",)'
            raw=re.sub(pattern,lambda m:m[1]+'\n      "cover_file": "'+newname+'",',raw,count=1)
        else:raw=raw.replace('"cover_file": "'+oldname+'"','"cover_file": "'+newname+'"')
    datafile.write_text(raw,encoding='utf-8',newline='\n')
    report={'ticket':'8a34cbd1708a4b66a57a9d0244756b8c','scope':'four cover footers only; article prose, figure bytes, slugs and primary-source findings retained','original_generator':str(ORIGINAL),'generator_sha256':sha(ORIGINAL),'results':rows,'browser_review':'required; no browser pass claimed'}
    (OUT/'repair.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    contact=Image.new('RGB',(760,760),'white')
    for i,row in enumerate(rows):
        im=Image.open(ROOT/row['versioned']);im.thumbnail((380,380));contact.paste(im,((i%2)*380,(i//2)*380))
    contact.save(OUT/'covers-390.jpg',quality=95)
    print(json.dumps({'covers':len(rows),'report':str(OUT/'repair.json'),'originals_retained':True},ensure_ascii=False))

if __name__=='__main__':main()
