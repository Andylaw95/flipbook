"""Original, deterministic vector artwork for the public Flipbook demo."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'examples/form-and-field.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = 480, 640
PAPER, INK, RUST, OLIVE, SUN, BLUSH = '#F4EEDD', '#28352E', '#A44630', '#7E8760', '#D8A843', '#DABCAE'
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1, invariant=1)
c.setTitle('Form & Field | A sample publication')
c.setAuthor('Flipbook contributors')
c.setSubject('Original neutral editorial artwork for the public Flipbook demonstration')
c.setCreator('Flipbook demo assets')
c._doc.info.producer = 'Flipbook demo assets'

def rect(x,y,w,h,color):
    c.setFillColor(HexColor(color)); c.rect(x,H-y-h,w,h,fill=1,stroke=0)
def circle(x,y,r,color):
    c.setFillColor(HexColor(color)); c.circle(x,H-y,r,fill=1,stroke=0)
def ellipse(x,y,w,h,color):
    c.setFillColor(HexColor(color)); c.ellipse(x,H-y-h,x+w,H-y,fill=1,stroke=0)
def line(x1,y1,x2,y2,color=INK,width=.6):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(width); c.line(x1,H-y1,x2,H-y2)
def text(s,x,y,size=12,font='Helvetica',color=INK):
    c.setFont(font,size); c.setFillColor(HexColor(color)); c.drawString(x,H-y-size*.78,s)
def lines(ss,x,y,size=12,font='Helvetica',color=INK,leading=None):
    for i,s in enumerate(ss): text(s,x,y+i*(leading or size*1.35),size,font,color)
def label(s,x=34,y=28,color=INK):
    t=c.beginText(x,H-y-8); t.setFont('Helvetica',8); t.setCharSpace(1.6); t.setFillColor(HexColor(color)); t.textLine(s); c.drawText(t)
def base(n,bg=PAPER,fg=INK,section='A JOURNAL OF SHAPE & COLOUR'):
    rect(0,0,W,H,bg); label('FORM & FIELD',color=fg); label(section,232,28,fg)
    line(34,51,446,51,fg)
    line(34,601,446,601,fg)
    text('ISSUE 01  /  ORIGINAL SAMPLE',34,612,7,color=fg)
    text(f'{n:02}',432,610,9,color=fg)
def end(): c.showPage()

# 01 — cover: large typography and a graphic landscape.
rect(0,0,W,H,PAPER)
label('AN INDEPENDENT STUDY OF SHAPE & COLOUR',34,30)
text('FORM',30,73,82,'Helvetica-Bold')
text('& FIELD',30,158,77,'Helvetica-Bold')
text('Ordinary forms. New perspectives.',34,255,18,'Times-Italic')
rect(34,300,412,266,OLIVE)
circle(337,361,45,SUN)
ellipse(-70,432,570,280,INK)
ellipse(245,390,430,350,RUST)
rect(0,566,480,74,PAPER)
label('VOL. 01',34,593)
label('THE ART OF LOOKING CLOSER',221,593)
end()

# 02 / 03 — opening spread.
base(2)
label('01 / OBSERVATION',34,84)
lines(['A slower', 'way to see.'],32,127,53,'Times-Roman',leading=56)
lines(['Look beyond the familiar.', 'A curve, a shadow, a quiet horizon:', 'small details change the whole picture.'],34,282,14,leading=21)
line(34,376,92,376,RUST,3)
lines(['This imaginary journal explores the rhythm of', 'simple forms. Every illustration begins with a', 'circle, a line or a shape found in everyday life.', '', 'Take your time. Turn a page. Look again.'],34,405,12,leading=20)
text('Original shapes. Imaginary places.',34,563,11,'Times-Italic')
end()
base(3,INK,PAPER,'PLATE 01 / THE HORIZON')
rect(34,83,412,452,BLUSH)
circle(317,189,64,SUN)
ellipse(-210,304,870,600,OLIVE)
ellipse(200,289,600,650,RUST)
rect(0,535,W,105,INK)
rect(0,51,34,484,INK); rect(446,51,34,484,INK)
text('Where colour meets calm.',34,558,22,'Times-Italic',PAPER)
line(34,601,446,601,PAPER); text('FORM & FIELD / PLATE 01',34,612,7,color=PAPER); text('03',432,610,9,color=PAPER)
end()

# 04 / 05 — sculptural balance.
base(4,BLUSH,INK,'02 / COMPOSITION')
text('The shape',34,85,47,'Times-Roman')
text('of balance.',34,137,47,'Times-Roman')
text('Less noise. More presence.',34,208,14)
rect(34,256,412,297,PAPER)
ellipse(96,508,288,21,'#D5CBB4')
rect(133,423,205,83,OLIVE)
circle(238,367,67,RUST)
rect(169,284,137,26,INK)
text('A study in weight, space and proportion.',34,570,11,'Times-Italic')
end()
base(5,PAPER,INK,'PLATE 02 / EQUILIBRIUM')
label('COMPOSITION NOTES',34,86)
text('Let space',34,132,44,'Helvetica-Bold')
text('do the work.',34,181,44,'Helvetica-Bold')
lines(['An open margin gives a form room to breathe.', 'A small accent can bring a page into focus.', 'Balance comes from the space between.'],34,269,12,leading=20)
for i,(s,col,desc) in enumerate([('01',RUST,'A warm point of focus'),('02',OLIVE,'A grounded foundation'),('03',INK,'A clear finishing line')]):
    y=382+i*57
    circle(49,y+12,14,col); text(s,42,y+7,9,'Helvetica-Bold',PAPER)
    text(desc,80,y+4,13); line(80,y+31,446,y+31,'#C7C5AF')
end()

# 06 / 07 — graphic architecture.
base(6,INK,PAPER,'03 / PERSPECTIVE')
lines(['Small things.', 'Big presence.'],34,92,46,'Times-Roman',PAPER,54)
lines(['One shape becomes a pattern.', 'One pattern becomes a place.'],34,231,15,color=PAPER,leading=23)
for row in range(3):
    for col in range(5):
        x=34+col*83; y=336+row*76
        rect(x,y,65,61,[OLIVE,RUST,SUN][(row+col)%3])
        circle(x+32.5,y+30.5,16,INK)
end()
base(7,PAPER,INK,'PLATE 03 / OPEN DOORS')
rect(34,83,412,452,RUST)
rect(96,215,288,320,BLUSH); circle(240,215,144,BLUSH)
rect(145,232,190,303,INK); circle(240,232,95,INK)
rect(192,340,96,195,OLIVE); circle(240,340,48,OLIVE)
text('A little room for possibility.',34,558,22,'Times-Italic')
end()

# 08 / 09 — colour studio.
base(8,PAPER,INK,'04 / COLOUR')
text('A palette',34,90,53,'Times-Roman')
text('from the earth.',34,145,46,'Times-Roman')
lines(['Warm stone. Deep leaves. Late afternoon light.', 'Colour holds the feeling of a place.'],34,241,12,leading=20)
for i,(name,col) in enumerate([('CLAY',RUST),('MOSS',OLIVE),('OCHRE',SUN),('FOREST',INK)]):
    x=34+i*105
    rect(x,333,94,178,col); label(name,x,530)
end()
base(9,OLIVE,PAPER,'PLATE 04 / RHYTHM')
for i in range(5):
    for j in range(6):
        x=34+i*82; y=85+j*77
        if (i+j)%2: circle(x+37,y+34,31,PAPER)
        else: rect(x+6,y+3,62,62,INK)
text('A simple rhythm, repeated.',34,560,22,'Times-Italic',PAPER)
end()

# 10 / 11 — large editorial closing spread.
base(10,RUST,PAPER,'05 / REFLECTION')
lines(['Make room', 'for a new', 'perspective.'],32,101,54,'Times-Roman',PAPER,63)
circle(153,446,78,SUN); rect(153,368,235,156,BLUSH)
rect(153,446,235,78,INK)
end()
base(11,PAPER,INK,'COLOPHON')
label('ABOUT THIS PUBLICATION',34,90)
text('Made to be',34,139,46,'Helvetica-Bold')
text('turned.',34,191,61,'Helvetica-Bold')
lines(['Form & Field is an original sample publication', 'created for the source-available Flipbook reader.', '', 'The places are imaginary. The illustrations', 'use simple vector shapes. There are no stock', 'photographs, private documents or paid assets.', '', 'Words and artwork: Flipbook contributors.', 'See repository LICENSE for the applicable terms.'],34,296,12,leading=21)
text('A small publication. A fresh point of view.',34,557,17,'Times-Italic')
end()

# 12 — back cover.
rect(0,0,W,H,INK)
label('FORM & FIELD',34,34,PAPER)
circle(240,257,132,OLIVE); circle(240,257,89,SUN); circle(240,257,44,RUST)
lines(['Turn a', 'new page.'],34,425,61,'Times-Roman',PAPER,61)
label('ORIGINAL SAMPLE / ISSUE 01',34,596,PAPER)
end()
c.save()
print(f'{OUT.name}: 12 pages, {OUT.stat().st_size} bytes')
