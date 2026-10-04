"""Narrow layouts from the Figma exports (mobile.txt = 414 frames, tablet.txt = 768 frames), matched to the desktop items by position."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))


class Layout:
    def __init__(self, fname):
        self.REC, self.H, self.SH, self.K, self.used = [], [], [], 0.5, set()
        for ln in open(os.path.join(HERE, fname), encoding='utf-8'):
            ln = ln.rstrip('\n')
            if ln.startswith('#H'): self.H = [int(v) for v in ln[3:].split(',')]; continue
            if ln.startswith('#S'): self.SH = [int(v) for v in ln[3:].split(',')]; continue
            if ln.startswith('#K'): self.K = float(ln[3:]); continue
            if not ln or ln.startswith('#'): continue
            p = ln.split('|')
            self.REC.append(dict(ch=int(p[0]), st=int(p[1]), t=p[2], dx=int(p[3]), dy=int(p[4]), dw=int(p[5]), mx=float(p[6]), my=float(p[7]),
                                 mw=float(p[8]), mh=float(p[9]), fs=float(p[10]) if p[10] else None, fixed=p[11] == '1', vis=p[12] == '1', ms=p[13]))
        hub = next(r for r in self.REC if r['ch'] == 6 and r['t'] == 'E')
        self.HX, self.HY = hub['mx'] + hub['mw'] / 2, hub['my'] + hub['mh'] / 2   # the "you" dot of 06; network + shared frames scale K around it

    def find(self, ch, st, it):
        """Record for a desktop item (None = not in this layout)."""
        t, best, bd = it['t'], None, 1e9
        for i, r in enumerate(self.REC):
            if i in self.used or r['ch'] != ch or r['st'] != st or r['t'] != t: continue
            d = abs(r['dx'] - it.get('x', 0)) + abs(r['dy'] - it.get('y', 0))
            if d < bd: best, bd = i, d
        if best is not None and bd <= 6:
            self.used.add(best); return self.REC[best]
        # fallbacks: same column a little higher/lower (site nudged it), or the 3D anchor of that chapter
        for i, r in enumerate(self.REC):
            if i in self.used or r['ch'] != ch or r['st'] != st or r['t'] != t: continue
            if (t != 'I' and abs(r['dx'] - it.get('x', 0)) <= 2 and abs(r['dy'] - it.get('y', 0)) <= 60) or t == 'I':
                self.used.add(i); return r
        return None


LAYOUTS = {'m': Layout('mobile.txt'), 'q': Layout('tablet.txt')}   # m = phone (414), q = tablet (768)
