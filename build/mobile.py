"""Mobile (414) layout from the Figma export in mobile.txt, matched to the desktop items by position."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
REC, H, SH = [], [], []
for ln in open(os.path.join(HERE, 'mobile.txt'), encoding='utf-8'):
    ln = ln.rstrip('\n')
    if ln.startswith('#H'): H = [int(v) for v in ln[3:].split(',')]; continue
    if ln.startswith('#S'): SH = [int(v) for v in ln[3:].split(',')]; continue
    if not ln or ln.startswith('#'): continue
    p = ln.split('|')
    REC.append(dict(ch=int(p[0]), st=int(p[1]), t=p[2], dx=int(p[3]), dy=int(p[4]), dw=int(p[5]), mx=float(p[6]), my=float(p[7]),
                    mw=float(p[8]), mh=float(p[9]), fs=float(p[10]) if p[10] else None, fixed=p[11] == '1', vis=p[12] == '1', ms=p[13]))
used = set()

def find(ch, st, it):
    """Mobile record for a desktop item (None = not on mobile)."""
    t = it['t']
    best, bd = None, 1e9
    for i, r in enumerate(REC):
        if i in used or r['ch'] != ch or r['st'] != st or r['t'] != t: continue
        d = abs(r['dx'] - it.get('x', 0)) + abs(r['dy'] - it.get('y', 0))
        if d < bd: best, bd = i, d
    if best is not None and bd <= 6:
        used.add(best); return REC[best]
    # fallbacks: same column a little higher/lower (site nudged it), or the 3D anchor of that chapter
    for i, r in enumerate(REC):
        if i in used or r['ch'] != ch or r['st'] != st or r['t'] != t: continue
        if (t != 'I' and abs(r['dx'] - it.get('x', 0)) <= 2 and abs(r['dy'] - it.get('y', 0)) <= 60) or t == 'I':
            used.add(i); return r
    return None
