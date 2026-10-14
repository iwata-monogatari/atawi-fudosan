"""Generate the published fictional three-page detailed example; not a customer report."""
from pathlib import Path
import argparse, json
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output',default=str(root/'karte/sample/pdf/fujigaoka-jikka-karte-detail-sample.pdf'))
parser.add_argument('--font',default='C:/Windows/Fonts/msgothic.ttc')
args=parser.parse_args()
if Path(args.font).exists():
    pdfmetrics.registerFont(TTFont('Japanese',args.font,subfontIndex=0))
    font='Japanese'
else:
    pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'));font='HeiseiKakuGo-W5'
pdfmetrics.registerFontFamily(font,normal=font,bold=font,italic=font,boldItalic=font)
policy=json.loads((root/'data/karte-service-policy.json').read_text(encoding='utf-8'))
navy=colors.HexColor('#114c6d');blue=colors.HexColor('#eaf5fa');line=colors.HexColor('#c9dfe9')
styles=getSampleStyleSheet()
for name in styles.byName:
    styles[name].fontName=font
styles.add(ParagraphStyle('BodyJP',fontName=font,wordWrap='CJK',fontSize=11,leading=18,spaceAfter=10,textColor=colors.HexColor('#193e53')))
styles.add(ParagraphStyle('NoteJP',fontName=font,wordWrap='CJK',fontSize=9.5,leading=15,spaceAfter=8,textColor=colors.HexColor('#526d7c')))
styles.add(ParagraphStyle('TitleJP',fontName=font,wordWrap='CJK',fontSize=24,leading=33,spaceAfter=15,textColor=navy))
styles.add(ParagraphStyle('SectionJP',fontName=font,wordWrap='CJK',fontSize=16,leading=24,spaceBefore=10,spaceAfter=8,textColor=navy))
styles.add(ParagraphStyle('CellJP',fontName=font,wordWrap='CJK',fontSize=10,leading=15,textColor=colors.HexColor('#193e53')))
items=[]
def p(text,style='BodyJP'):return Paragraph(text,styles[style])
def title(section):
    items.extend([p('ふじがおか 実家カルテ','TitleJP'),p(section,'SectionJP'),p('詳しい構成見本 / 架空の物件・金額・確認結果','NoteJP')])
def section(name,text):items.extend([p(name,'SectionJP'),p(text)])
title('01 判断のための要約')
items.extend([p('親が施設へ入った家。売るか残すか迷っている場合の構成例。'),p('所在地・面積・金額・確認結果はすべて説明用の架空例です。地域の相場や実在物件の査定ではありません。実際の内容とページ数は物件によって変わります。','NoteJP')])
box=Table([[p('価格の目安','SectionJP')],[p('約980万〜1,260万円','TitleJP')],[p('架空の数値。例示の前提：磐田市内の住宅、土地約160㎡・木造住宅。現地・建物状態・権利や境界は未確認。','NoteJP')]],colWidths=[511])
box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),blue),('LEFTPADDING',(0,0),(-1,-1),16),('RIGHTPADDING',(0,0),(-1,-1),16),('BOTTOMPADDING',(0,0),(-1,-1),10)]));items.append(box)
section('対象と価格の根拠','対象は土地1筆・建物1棟。所有者本人が存命で、家族から相談した架空例です。実際のカルテでは、参照資料・比較条件・算定日を記載します。この見本に実在の取引データは使っていません。')
section('分かったこと / これから確認すること','資料で土地・建物の登記概要と公図上の敷地の形を確認した例です。本人の意向、建物状態、境界標、道路の扱いは追加確認が必要な例として分けます。未確認を欠陥とは決めつけません。')
section('売る場合 / 残す場合','売る場合は本人の意思と家の状態、価格が変わる条件を確認。残す場合は管理する人・費用・利用予定を比較します。片付けや修繕は見積もりを確認して判断します。')
items.append(PageBreak())
title('02 確認点を分けて記載する')
items.append(p('下記はすべて架空の状態です。「資料で確認」は、実際の物件を確認済みという意味ではありません。','NoteJP'))
rows=[['確認項目','見本の状態','見本の所見','次の確認先'],
['名義・権利','資料で確認','登記に記載された所有者は本人。売却の意向は未確認。','本人・家族'],
['抵当権','追加確認','詳細欄を確認し、設定があれば抹消の要否を整理。','登記資料'],
['土地・面積','資料で確認','登記面積は把握。現況面積と同じかは確認していない。','現地・資料'],
['境界','現地未確認','公図はあるが、境界標や隣地との認識は未確認。','現地・隣地'],
['道路','個別照会','公図上の接続だけで、法上の道路種別は断定しない。','行政窓口'],
['建物の状態','現地未確認','築年数だけで修繕費や解体の要否を決めない。','現地・見積'],
['家財・管理','家族に確認','残る荷物、施錠・通風、毎月の管理負担を確認。','本人・家族'],
['法令・災害','資料で確認','公開資料の概要を確認。個別適用や現況は別途確認。','資料・行政'],
['価格への影響','条件付き','境界・道路・建物状態に応じ、価格の目安を見直す。','担当者']]
table=Table([[p(c,'CellJP') for c in row] for row in rows],colWidths=[76,82,256,97],repeatRows=1)
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),blue),('GRID',(0,0),(-1,-1),.5,line),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12)]));items.extend([table,Spacer(1,16),p('実際のカルテでは参照資料名・確認日・確認できた範囲を記載します。法律・税・登記・測量・建物検査の個別判断は、必要に応じて専門家へ確認します。','NoteJP'),PageBreak()])
title('03 次の対応と、費用・受取方法')
section('1 本人の意向と家族の方針','売る・残すを今すぐ決めず、本人の希望・利用予定・判断時期を確認します。')
section('2 価格に影響する条件','境界・道路・建物状態など、価格が変わり得る点を優先して確認します。')
section('3 売却と保有の比較','売る場合の査定、残す場合の管理・費用を並べ、必要な支出は見積もりで確認します。')
section('当社で行う確認・整理は無料','価格の目安、確認点と次の対応、必要な資料の取得実費は無料。必要な現地確認・訪問査定・役所確認も無料です。金額を出せない場合は理由と次の確認を記載します。')
section('専門家の実務費は、見積もりを確認','当社が専門家を紹介し、見積もりを取得します。測量・表題登記・接道等の専門家業務は、内容と見積もりを確認してから依頼し、各専門家がお客様へ請求します。')
section('PDFのお渡し',policy['copy']['delivery'])
items.append(p('初回連絡は原則2営業日以内。受付日の翌営業日から数え、水曜・日曜・臨時休業日を除きます。PDF送付の2日は土日も数える別の期限です。','NoteJP'))
items.append(p(policy['copy']['aftercare'],'NoteJP'))
def footer(canvas,doc):
    canvas.saveState();canvas.setFont(font,9);canvas.setFillColor(navy)
    canvas.drawString(42,28,'富士ヶ丘サービス株式会社 / 架空の詳しい構成見本')
    canvas.drawRightString(553,28,f'{doc.page} / 3');canvas.restoreState()
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
doc=SimpleDocTemplate(str(out),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=38,bottomMargin=48,title='ふじがおか実家カルテ 詳しい構成見本',author='富士ヶ丘サービス株式会社')
doc.build(items,onFirstPage=footer,onLaterPages=footer)
print(out)
