"""Builds site/index.html from the Figma layout export (build/ch_*.json).
Desktop layout = exact Figma coordinates in design units (1 unit = 100vw/1440).
Mobile layout = the same nodes in reading order (CSS switches positioning)."""
import json, glob, html, os, re

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


def text(it, extra_cls=''):
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
    style = (f"--x:{it['x']};--y:{it['y']};--w:{it['w']};--z:{z};--mz:{mobile_px(z)}px;"
             f"--lh:{it['lh'] / 100 if it['lh'] else 1.2};--ls:{it['ls'] / 100}em;font-weight:{WEIGHT.get(sty, 400)};color:{color(it.get('c'))}"
             + (f";text-align:{it['al'].lower()};width:calc({it['w']} * var(--u))" if it.get('al') in ('CENTER', 'RIGHT') else ''))
    if it.get('st'):  # outlined, dashed type (ПАМЯТЬ) -> svg text
        dash = ' '.join(str(d) for d in (it.get('dash') or []))
        return (f'<svg class="it outline rv" style="{style}" viewBox="0 0 {it["w"]} {it["h"]}" aria-label="{esc(s)}">'
                f'<text x="0" y="{z * 0.78:.0f}" font-size="{z}" letter-spacing="{it["ls"] / 100 * z:.1f}" '
                f'fill="none" stroke="{it["st"]}" stroke-width="1.5" stroke-dasharray="{dash}">{esc(s)}</text></svg>')
    if title:
        inner = ''.join(f'<span class="ln"><span>{esc(line)}</span></span>' for line in s.split('\n'))
    else:
        inner = esc(s)
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
    st = ''
    if it.get('st'):
        st = f';box-shadow:inset 0 0 0 1px {color(it["st"])}'
    return f'<div class="{" ".join(cls)}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]};background:{color(it.get("c"))}{st}"></div>'


def anchor(key, it, cls=''):
    return (f'<div class="it a3d {cls}" data-a3d="{key}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]}">'
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
            out.append(f'<div class="it link" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--r:{-it["rot"]}deg"></div>')
        elif t == 'I':
            for frag, key in ANCHORS:
                if frag in it['name']:
                    out.append(anchor(key, it))
                    break
        elif t == 'B':
            for frag, key in BULK.items():
                if it['name'].startswith(frag):
                    out.append(f'<div class="it bulk" data-bulk="{key}" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]}"><canvas></canvas></div>')
        elif t == 'F' and it.get('name') == 'share':
            kids = []
            for k in it['kids']:
                if k['t'] == 'P':
                    kids.append(f'<img class="it share-img" style="--x:{k["x"]};--y:{k["y"]};--w:{k["w"]};--h:{k["h"]}" src="assets/posters/year_record.png" alt="" loading="lazy">')
                else:
                    kids.append(text(k).replace(' rv', ''))
            out.append(f'<div class="it share" style="--cx:{it["cx"]};--cy:{it["cy"]};--w:{it["w"]};--h:{it["h"]};--rot:{-it["rot"]}deg;background:{color(it["c"])}">{"".join(kids)}</div>')
        elif t == 'F' and it.get('name') == 'Story composition':
            kids = ''.join(text(k) for k in it['kids'])
            out.append(f'<div class="it card" style="--x:{it["x"]};--y:{it["y"]};--w:{it["w"]};--h:{it["h"]};background:{color(it["c"])}">{kids}<div class="card-bar"></div></div>')
    return '\n'.join(out)


sections = []
for idx, name in enumerate(ORDER):
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
            kids = render_items(s['kids'], name)
            if k == 4:
                kids += anchor('result', {'x': 620, 'y': 40, 'w': 840, 'h': 630}, 'result')
            st.append(f'<div class="state" data-state="{k}">{kids}</div>')
        states_html = f'<div class="states">{"".join(st)}</div>'
        items = intro
    body = render_items(items, name)
    sections.append(
        f'<section class="ch" id="chapter-{num}" data-ch="{idx}" aria-label="Глава {num}">\n'
        f'<div class="stage"><div class="inner" style="--h:{h}">\n{body}\n</div>{states_html}</div>\n</section>')

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
