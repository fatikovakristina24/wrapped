"""Builds site/index.html from the Figma layout export (build/ch_*.json).
Desktop layout = exact Figma coordinates in design units (1 unit = 100vw/1440).
Phone layout = the 414 Figma frames (build/mobile.txt, 1 unit = 100vw/414), tablet = the 768 frames (build/tablet.txt, 1 unit = 100vw/768),
both matched to the same nodes; CSS picks one by viewport width."""
import json, glob, html, os, re
import mobile

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

data = {}
for f in sorted(glob.glob(os.path.join(HERE, 'ch_*.json'))):
    data.update(json.load(open(f, encoding='utf-8')))

ORDER = ['00_HERO', '01_365_DAYS', '02_HISTORY', '03_DATA', '04_VISUAL_LANGUAGE', '05_STORYTELLING', '06_SOCIAL', '07_ALGORITHM', '08_FINAL']
WEIGHT = {'Black': 900, 'ExtraBold': 800, 'Bold': 700, 'SemiBold': 600, 'Medium': 500, 'Regular': 400, 'Light': 300, 'ExtraLight': 200, 'Thin': 100}
ANCHORS = [('hero_ring (back)', 'hero'), ('ring365 (back)', 'ring'), ('history_2015', 'h2015'), ('history_2016', 'h2016'),
           ('history_now', 'hnow'), ('data_minutes', 'minutes'), ('data_tracks', 'tracks'), ('data_artists', 'artists'),
           ('data_genres', 'genres'), ('lab_speaker', 'lab'), ('story_path (intro', 'story'), ('social_spread', 'social'),
           ('algo_broken', 'algo'), ('final_memory', 'final')]
POSTER = {'hero': 'hero_vinyl', 'ring': 'year_record', 'h2015': 'history_2015', 'h2016': 'history_2016', 'hnow': 'history_now',
          'minutes': 'hourglass', 'tracks': 'data_tracks', 'artists': 'data_artists', 'genres': 'data_genres', 'lab': 'lab_vortex',
          'story': 'story_tape', 'social': 'social_mic', 'algo': 'algo_cassette', 'final': 'final_glass_vinyl', 'result': 'gift_2026'}
BULK = {'Year signal': 'signal', 'Year strip': 'strip', 'Emblem': 'emblem'}
COUNTER = re.compile(r'^(×)?(\d[\d ]*)(×|%| ч)?$')


CUR = {'ch': 0, 'st': -1}
L = mobile.LAYOUTS


def mob(it):
    """(extra classes, extra style, records) that place this item on the phone (m) and tablet (q) layouts, or hide it there."""
    cls, st, recs = '', '', {}
    for p, lay in L.items():
        r = lay.find(CUR['ch'], CUR['st'], it)
        if not r or not r['vis']:
            cls += f' {p}h'; continue
        recs[p] = r
        st += f";--{p}x:{r['mx']};--{p}y:{r['my']};--{p}w:{r['mw']};--{p}h:{r['mh']}"
        cls += f' {p}'
        if r['fs']:
            st += f";--{p}f:{r['fs']}"
            if r['fixed']: cls += f' {p}w'
        if it['t'] == 'F':
            st += f";--{p}k:{r['mw'] / it['w']:.4f}"
    return cls, st, recs


def net(x, y):
    """06 network / shared frames: desktop point -> both narrow layouts (scaled around the hub)."""
    return ''.join(f";--{p}lx:{lay.HX + (x - 700) * lay.K:.1f};--{p}ly:{lay.HY + (y - 1150) * lay.K:.1f}" for p, lay in L.items())


def esc(s):
    return html.escape(s, quote=False)


def mobile_px(z):
    for lim, px in [(11, 11), (13, 12), (18, 15), (20, 17), (30, 21), (44, 26), (60, 30), (112, 44), (180, 64), (240, 76), (420, 120)]:
        if z <= lim:
            return px
    return 140


def color(c):
    if not c:
        return 'transparent'
    h, a = c[0], c[1]
    if a >= 1:
        return h
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    return f'rgba({r},{g},{b},{a})'


def text(it, extra_cls='', nested=False):
    fam, sty = it['f'].split(':')
    family = 'U' if fam == 'U' else 'O'
    cls = ['it', 't', 'f' + family, 'rv']
    s = it['s']
    z = it['z']
    if it.get('wrap'):
        cls.append('wrap')
    if it.get('up'):
        cls.append('up')
    title = family == 'U' and WEIGHT.get(sty, 400) >= 700 and z >= 90
    if title:
        cls.append('title')
    m = COUNTER.match(s.strip())
    attrs = ''
    if m and z >= 36:
        cls.append('cnt')
        attrs = f' data-to="{m.group(2).replace(" ", "")}" data-pre="{m.group(1) or ""}" data-suf="{m.group(3) or ""}" data-sep="{1 if " " in m.group(2) else 0}"'
    if extra_cls:
        cls.append(extra_cls)
    mc, ms, mr = ('', '', {}) if nested else mob(it)
    cls += mc.split()
    style = (f"--x:{it['x']};--y:{it['y']};--w:{it['w']};--z:{z};--mz:{mobile_px(z)}px;"
             f"--lh:{it['lh'] / 100 if it['lh'] else 1.2};--ls:{it['ls'] / 100}em;font-weight:{WEIGHT.get(sty, 400)};color:{color(it.get('c'))}"
             + (f";text-align:{it['al'].lower()};width:calc({it['w']} * var(--u))" if it.get('al') in ('CENTER', 'RIGHT') else '') + ms)
    if it.get('st'):  # outlined, dashed type (ПАМЯТЬ) -> svg text
        dash = ' '.join(str(d) for d in (it.get('dash') or []))
        return (f'<svg class="it outline rv{mc}" style="{style}" viewBox="0 0 {it["w"]} {it["h"]}" aria-label="{esc(s)}">'
                f'<text x="0" y="{z * 0.78:.0f}" font-size="{z}" letter-spacing="{it["ls"] / 100 * z:.1f}" '
                f'fill="none" stroke="{it["st"]}" stroke-width="1.5" stroke-dasharray="{dash}">{esc(s)}</text></svg>')
    if title:
        inner = ''.join(f'<span class="ln"><span>{esc(line)}</span></span>' for line in s.split('\n'))
    else:
        inner = esc(s)
    alt = next((r['ms'] for r in mr.values() if r['ms']), '')
    if alt:                                              # the narrow frames say it differently (→ becomes ↓)
        inner = f'<span class="dt">{inner}</span><span class="mt">{esc(alt)}</span>'
    if s.startswith('минут ....'):
        cls.append('typer')
    return f'<div class="{" ".join(cls)}" style="{style}"{attrs}>{inner}</div>'


def shape(it, cls_extra=''):
    t = it['t']
    cls = ['it', 'shape']
    if t == 'E':
        cls.append('dot')
    if it['h'] <= 1 or it['w'] <= 1:
        cls.append('hair')
    elif it['w'] <= 40 and it['h'] > 14:
        cls.append('vbar')
    elif it['h'] <= 14:
        cls.append('hbar')
    if cls_extra:
        cls.append(cls_extra)
    mc, ms, _ = mob(it)
    cls += mc.split()
    st = ''
    if it.get('st'):
        st = f';box-shadow:inset 0 0 0 1px {color(it["st"])}'
    return f'<div class="{" ".join(cls)}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]};background:{color(it.get("c"))}{st}{ms}"></div>'


def anchor(key, it, cls=''):
    mc, ms, _ = mob(dict(it, t='I'))
    return (f'<div class="it a3d {cls}{mc}" data-a3d="{key}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]}{ms}">'
            f'<img class="poster" src="assets/posters/{POSTER[key]}.png" alt="" loading="lazy" decoding="async"></div>')


def render_items(items, chapter):
    out = []
    items = sorted(items, key=lambda i: (i.get('y', i.get('cy', 0)), i.get('x', 0)))
    for it in items:
        t = it['t']
        if t == 'T':
            out.append(text(it))
        elif t in ('R', 'E'):
            out.append(shape(it))
        elif t == 'L':
            out.append(f'<div class="it link" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--r:{-it["rot"]}deg{net(it["x"], it["y"])}"></div>')
        elif t == 'I':
            for frag, key in ANCHORS:
                if frag in it['name']:
                    out.append(anchor(key, it))
                    break
        elif t == 'B':
            for frag, key in BULK.items():
                if it['name'].startswith(frag):
                    mc, ms, _ = mob(it)
                    out.append(f'<div class="it bulk{mc}" data-bulk="{key}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]}{ms}"><canvas></canvas></div>')
        elif t == 'F' and it.get('name') == 'share':
            kids = []
            for k in it['kids']:
                if k['t'] == 'P':
                    kids.append(f'<img class="it share-img" style="--x:{k["x"]};--y:{k["y"]};--w:{k["w"]};--h:{k["h"]}" src="assets/posters/year_record.png" alt="" loading="lazy">')
                else:
                    kids.append(text(k, nested=True).replace(' rv', ''))
            out.append(f'<div class="it share" style="--cx:{it["cx"]};--cy:{it["cy"]};--w:{it["w"]};--h:{it["h"]};--rot:{-it["rot"]}deg{net(it["cx"], it["cy"])};background:{color(it["c"])}">{"".join(kids)}</div>')
        elif t == 'F' and it.get('name') == 'Story composition':
            kids = ''.join(text(k, nested=True) for k in it['kids'])
            mc, ms, _ = mob(it)
            out.append(f'<div class="it card{mc}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]};background:{color(it["c"])}{ms}">{kids}<div class="card-bar"></div></div>')
    return '\n'.join(out)


sections = []
for idx, name in enumerate(ORDER):
    CUR['ch'], CUR['st'] = idx, -1
    ch = data[name]
    items = ch['items']
    h = ch['h']
    num = f'{idx:02d}'
    states_html = ''
    if name == '05_STORYTELLING':
        intro = [i for i in items if i['t'] != 'F']
        states = [i for i in items if i['t'] == 'F']
        h = 1200
        st = []
        for k, s in enumerate(states):
            CUR['st'] = k
            kids = render_items(s['kids'], name)
            if k == 4:
                kids += anchor('result', {'x': 620, 'y': 40, 'w': 840, 'h': 630}, 'result')
            st.append(f'<div class="state" data-state="{k}" style="--msh:{L["m"].SH[k]};--qsh:{L["q"].SH[k]}">{kids}</div>')
        CUR['st'] = -1
        states_html = f'<div class="states">{"".join(st)}</div>'
        items = intro
    body = render_items(items, name)
    sections.append(
        f'<section class="ch" id="chapter-{num}" data-ch="{idx}" aria-label="Глава {num}">\n'
        f'<div class="stage"><div class="inner" style="--h:{h};--mih:{L["m"].H[idx]};--qih:{L["q"].H[idx]}">\n{body}\n</div>{states_html}</div>\n</section>')

template = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
out = template.replace('<!--CHAPTERS-->', '\n'.join(sections))

# cache-busting: every module / stylesheet gets ?v=<content hash>, so a deploy never mixes old and new files
import hashlib
def ver(rel):
    return hashlib.md5(open(os.path.join(SITE, rel), 'rb').read()).hexdigest()[:8]
mods = sorted(glob.glob(os.path.join(SITE, 'js', '**', '*.js'), recursive=True))
entries = ',\n'.join(f'  "./{os.path.relpath(m, SITE)}": "./{os.path.relpath(m, SITE)}?v={ver(os.path.relpath(m, SITE))}"' for m in mods)
out = out.replace('"lenis": "https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.mjs"', '"lenis": "https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.mjs",\n' + entries)
out = out.replace('href="css/style.css"', f'href="css/style.css?v={ver("css/style.css")}"')
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out) // 1024, 'KB,', len(sections), 'chapters')
