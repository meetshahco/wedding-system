"""Hand painted lotus art for the invitation cards, written as plain SVG.

Everything is built from tapered 'brush' ribbons (thick at the belly, thin at the ends, like a pen with a flexible nib)
and painted fills that are nudged off the line with a little turbulence, so nothing looks like a vector icon.
"""
import math, random, urllib.parse

def R(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')

def catmull(pts, n=6):
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            out.append(tuple(.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3) for d in (0, 1)))
    out.append(tuple(pts[-1]))
    return out

def poly(points, close=True):
    d = 'M' + ' '.join(R(x) + ' ' + R(y) for x, y in points[:1]) + 'L' + ' '.join(R(x) + ' ' + R(y) for x, y in points[1:])
    return d + ('Z' if close else '')

def ribbon(samples, wf):
    """A brush stroke along `samples`; wf(u) gives the width at u in 0..1."""
    m = len(samples)
    L, Rr = [], []
    for i, (x, y) in enumerate(samples):
        a = samples[max(0, i - 1)]; b = samples[min(m - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        w = wf(i / (m - 1)) / 2
        L.append((x + nx * w, y + ny * w)); Rr.append((x - nx * w, y - ny * w))
    return poly(L + Rr[::-1])

def swell(a=.15, b=1.0, c=.15, peak=.45):
    """width profile: a at the start, b at `peak`, c at the end"""
    def f(u):
        if u < peak:
            t = u / peak; t = t * t * (3 - 2 * t); return a + (b - a) * t
        t = (u - peak) / (1 - peak); t = t * t * (3 - 2 * t); return b + (c - b) * t
    return f

# ---------------------------------------------------------------- petals (local space: base at 0,0, tip at 0,-L)
def petal_edge(L, w, side=1, flick=0):
    pts = [(0, 0), (.42 * w, -.07 * L), (.88 * w, -.26 * L), (1.0 * w, -.50 * L), (.78 * w, -.74 * L), (.42 * w, -.88 * L), (.17 * w, -.955 * L), (.05 * w, -.99 * L), (flick, -L)]
    return [(side * x, y) for x, y in pts]

def petal_paths(L, w, asym=0.0, flick=0.0, lw=1.0):
    right = catmull(petal_edge(L, w * (1 + asym), 1, flick), 4)
    left = catmull(petal_edge(L, w * (1 - asym), -1, flick), 4)
    body = poly(right + left[::-1][1:])
    # calligraphic outline: a ribbon down each edge, full at the belly and fading to hair lines at base and tip
    wf = swell(.04 * lw, .8 * lw, .05 * lw, .5)
    o1 = ribbon(right, wf); o2 = ribbon(left, wf)
    return body, o1 + o2, right, left

def veins(L, w, n=3):
    d = []
    for k in range(n):
        f = (k - (n - 1) / 2) / ((n - 1) / 2)          # -1..1
        tipx = f * .34 * w
        d.append('M%s %s C%s %s %s %s %s %s' % (R(f * .06 * w), R(-.10 * L), R(f * .30 * w), R(-.25 * L), R(f * .60 * w), R(-.52 * L), R(tipx), R(-.80 * L)))
    return ''.join(d)

# ---------------------------------------------------------------- one painted bloom (side view)
def bloom_defs(prefix, lw=1.0):
    protos = {'a': (46, 15.5, 0, 0), 'b': (40, 14.2, 0, 0), 'c': (33, 12.5, 0, 0), 'd': (27, 11, 0, 0), 'e': (40, 14.5, .06, 0)}
    defs = ''
    for k, (L, w, asym, fl) in protos.items():
        body, outline, right, left = petal_paths(L, w, asym, fl, lw)
        st = ''
        for sx in (-.30, .05, .32):
            pts = [(sx * w * .5, -.12 * L), (sx * w * .8, -.32 * L), (sx * w * .95, -.52 * L), (sx * w * .55, -.74 * L)]
            st += ribbon(catmull(pts, 4), swell(.1, 1.5 * (1.3 - abs(sx)), .05, .35))
        defs += '<path id="%sp%s" d="%s"/><path id="%so%s" d="%s"/><path id="%sv%s" d="%s"/><path id="%ss%s" d="%s"/>' % (prefix, k, body, prefix, k, outline, prefix, k, veins(L, w), prefix, k, st)
    return defs

def bloom(prefix, cx, by, s=1.0, rows=None, filt_id=None, vw=1.0):
    """a lotus whose base sits at cx,by: each petal is painted, then outlined, back to front so front petals hide the lines behind them"""
    rows = rows or [
        # proto, angle, tone
        ('e', -80, 'o'), ('e', 80, 'o'),
        ('b', -56, 'o'), ('b', 56, 'o'),
        ('a', -32, 'm'), ('a', 32, 'm'),
        ('a', 0, 'm'),
        ('c', -44, 'f'), ('c', 44, 'f'),
        ('c', -17, 'f'), ('c', 17, 'f'),
    ]
    out = ''
    for proto, ang, tone in rows:
        a = math.radians(ang)
        bx = cx + math.sin(a) * 4.5 * s
        byy = by + (1 - math.cos(a)) * 7 * s
        tr = 'translate(%s %s) rotate(%s) scale(%s)' % (R(bx), R(byy), R(ang), R(s))
        fill = prefix + {'o': 'wo', 'm': 'wm', 'f': 'wf'}[tone]
        g = ('<g transform="%s"><g%s><use xlink:href="#%sp%s" fill="url(#%s)"/><use xlink:href="#%sp%s" fill="url(#%sed)"/>'
             '<use xlink:href="#%sv%s" fill="none" stroke="#C4577D" stroke-width="%s" stroke-linecap="round" opacity=".36"/>'
             '<use xlink:href="#%ss%s" fill="#FFFFFF" opacity=".34"/></g>'
             '<use xlink:href="#%so%s" fill="#B5822B"/></g>') % (tr, (' filter="url(#%s)"' % filt_id) if filt_id else '', prefix, proto, fill, prefix, proto, prefix, prefix, proto, R(.4 * vw), prefix, proto, prefix, proto)
        out += g
    return out, ''

def grads(prefix):
    def lg(id_, stops, x1=0, y1=1, x2=0, y2=0):
        return '<linearGradient id="%s%s" x1="%s" y1="%s" x2="%s" y2="%s">%s</linearGradient>' % (prefix, id_, x1, y1, x2, y2, ''.join('<stop offset="%s" stop-color="%s"%s/>' % (o, c, (' stop-opacity="%s"' % a) if a is not None else '') for o, c, a in stops))
    g = lg('wo', [(0, '#FFF9F4', None), (.4, '#FADDE5', None), (.8, '#F2B0C4', None), (1, '#E27FA3', None)])
    g += lg('wm', [(0, '#FFF7F1', None), (.35, '#F9D2DD', None), (.75, '#EE9DB8', None), (1, '#DB6C93', None)])
    g += lg('wf', [(0, '#FFFCF8', None), (.3, '#FCE0E7', None), (.7, '#F4B0C6', None), (1, '#E5729A', None)])
    g += lg('ed', [(0, '#B33A6B', .30), (.22, '#B33A6B', 0), (.78, '#B33A6B', 0), (1, '#B33A6B', .26)], 0, 0, 1, 0)
    return g

def filt(prefix, k=1.5, f=.07, seed=4):
    return ('<filter id="%shp" x="-8%%" y="-8%%" width="116%%" height="116%%"><feTurbulence type="fractalNoise" baseFrequency="%s" numOctaves="2" seed="%s" result="n"/>'
            '<feDisplacementMap in="SourceGraphic" in2="n" scale="%s" xChannelSelector="R" yChannelSelector="G"/></filter>') % (prefix, f, seed, k)

# ---------------------------------------------------------------- brush vines
def vine(pts, w, curl=None, n=7):
    s = catmull(pts, n)
    return ribbon(s, swell(.2, w, .12, .4))

def dots_arc(cx, cy, r, a0, a1, n, r0, r1, col='#C79A3A'):
    out = ''
    for i in range(n):
        t = i / (n - 1) if n > 1 else .5
        a = math.radians(a0 + (a1 - a0) * t)
        rr = r0 + (r1 - r0) * (1 - abs(t - .5) * 2)
        out += '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (R(cx + r * math.cos(a)), R(cy + r * math.sin(a)), R(rr), col)
    return out

def svg(w, h, vb, body, defs=''):
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="%s" height="%s" viewBox="%s">%s%s</svg>' % (w, h, vb, ('<defs>%s</defs>' % defs) if defs else '', body)

GOLD = '#B5822B'
LEAF = '#5E8A63'

def crest():
    p = 'c'
    defs = grads(p) + bloom_defs(p) + filt(p, 1.3, .09, 7) + green_grad(p)
    paint, _ = bloom(p, 60, 70, .95, filt_id=p + 'hp')
    tl = vine([(56, 74), (42, 79), (27, 77), (16, 70), (11, 61), (15, 55), (21, 56), (22, 61)], 1.5)
    tr = vine([(64, 74), (78, 79), (93, 77), (104, 70), (109, 61), (105, 55), (99, 56), (98, 61)], 1.5)
    lfl = 'M47 76C37 71 27 73 19 78C29 82 41 82 49 78Z'
    lfr = 'M73 76C83 71 93 73 101 78C91 82 79 82 71 78Z'
    leaves = ('<g filter="url(#%shp)"><path d="%s" fill="url(#%sgs)"/><path d="%s" fill="url(#%sgs)"/></g>' % (p, lfl, p, lfr, p) +
              '<path d="M49 78C41 76 31 77 22 78M71 78C79 76 89 77 98 78" stroke="#C9A04A" stroke-width=".6" fill="none"/>' +
              '<path d="%s" fill="none" stroke="#B5822B" stroke-width=".6"/><path d="%s" fill="none" stroke="#B5822B" stroke-width=".6"/>' % (lfl, lfr))
    body = (leaves + '<g fill="%s"><path d="%s"/><path d="%s"/><circle cx="22" cy="61.5" r="1.5"/><circle cx="98" cy="61.5" r="1.5"/></g>' % (GOLD, tl, tr) + paint +
            dots_arc(60, 66, 54, 205, 335, 9, .45, 1.2))
    return svg(120, 92, '0 0 120 92', body, defs)


def leaf_pad(cx, cy, rx, ry, pre):
    """a lotus leaf seen from a low angle: an ellipse with a notch, veins fanning out from the stalk in the middle"""
    veinsd = ''
    for k in range(-5, 6):
        a = math.radians(k * 17 + 4)
        ex, ey = cx + math.sin(a) * rx * .92, cy + math.cos(a) * ry * .86
        veinsd += 'M%s %sL%s %s' % (R(cx), R(cy), R(ex), R(ey))
    d = ('M%s %sC%s %s %s %s %s %sC%s %s %s %s %s %sC%s %s %s %s %s %sZ' %
         (R(cx - rx), R(cy), R(cx - rx * .9), R(cy - ry * 1.15), R(cx + rx * .35), R(cy - ry * 1.35), R(cx + rx * .98), R(cy - ry * .3),
          R(cx + rx * .6), R(cy - ry * .05), R(cx + rx * .35), R(cy + ry * .1), R(cx + rx * .15), R(cy + ry * .22),
          R(cx - rx * .35), R(cy + ry * 1.2), R(cx - rx * .95), R(cy + ry * 1.0), R(cx - rx), R(cy)))
    return ('<clipPath id="%scp"><path d="%s"/></clipPath><g filter="url(#%shp)"><path d="%s" fill="url(#%sgl)"/></g><path d="%s" clip-path="url(#%scp)" fill="none" stroke="#D8B25E" stroke-width=".55" stroke-linecap="round" opacity=".9"/>'
            '<path d="%s" fill="none" stroke="#B5822B" stroke-width=".8" stroke-linejoin="round"/>') % (pre, d, pre, d, pre, veinsd, pre, d)

def green_grad(pre):
    return ('<linearGradient id="%sgl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9DBE8E"/><stop offset=".6" stop-color="#6D9970"/><stop offset="1" stop-color="#4F7C5C"/></linearGradient>'
            '<linearGradient id="%sgs" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4F7C5C"/><stop offset="1" stop-color="#7FA57D"/></linearGradient>') % (pre, pre)

def bud(pre, cx, cy, s):
    rows = [('b', -14, 'o'), ('b', 14, 'o'), ('a', 0, 'm')]
    sep = ('<path d="M%s %sC%s %s %s %s %s %s C%s %s %s %s %s %sZ" fill="url(#%sgs)" stroke="#B5822B" stroke-width=".5"/>' %
           (R(cx), R(cy + 1), R(cx - 7 * s), R(cy - 2 * s), R(cx - 9 * s), R(cy - 10 * s), R(cx - 4 * s), R(cy - 13 * s), R(cx - 2 * s), R(cy - 8 * s), R(cx - 1 * s), R(cy - 4 * s), R(cx), R(cy + 1), pre))
    seg = bloom(pre, cx, cy, s, rows=rows, filt_id=pre + 'hp', vw=1.6)[0]
    return seg + sep

def sprig():
    pre = 's'
    defs = grads(pre) + bloom_defs(pre, 2.1) + filt(pre, .9, .09, 5) + green_grad(pre)
    main = catmull([(16, 138), (12, 124), (15, 108), (25, 92), (36, 79)], 8)
    stem = ribbon(main, swell(1.3, 1.9, 1.0, .35))
    br = ribbon(catmull([(14.5, 113), (26, 109), (39, 104), (50, 98)], 8), swell(1.5, 1.2, .8, .3))
    curl = ribbon(catmull([(13, 120), (6, 116), (2.5, 109), (3.5, 102), (8, 100), (10.5, 104), (9, 108)], 7), swell(.5, 1.25, .12, .3))
    rows = [('e', -78, 'o'), ('e', 78, 'o'), ('b', -52, 'o'), ('b', 52, 'o'), ('a', -28, 'm'), ('a', 28, 'm'), ('a', 0, 'm'), ('c', -40, 'f'), ('c', 40, 'f'), ('c', -13, 'f'), ('c', 13, 'f')]
    body = (leaf_pad(18, 139, 17.5, 6.2, pre) +
            '<path d="%s" fill="url(#%sgs)"/><path d="%s" fill="url(#%sgs)"/>' % (stem, pre, br, pre) +
            '<path d="%s" fill="#B5822B"/><circle cx="9" cy="108.2" r="1.4" fill="#B5822B"/>' % curl +
            bloom(pre, 37, 78, .6, rows=rows, filt_id=pre + 'hp', vw=1.5)[0] +
            bud(pre, 51, 99, .46) +
            '<circle cx="23" cy="45" r="1.1" fill="#C79A3A"/><circle cx="52" cy="50" r="1.1" fill="#C79A3A"/><circle cx="37.5" cy="36" r="1.5" fill="#C79A3A"/><circle cx="30" cy="39" r=".7" fill="#C79A3A"/><circle cx="45" cy="40" r=".7" fill="#C79A3A"/>')
    return svg(70, 146, '0 0 70 146', body, defs)

def ornament():
    pre = 'o'
    defs = grads(pre) + bloom_defs(pre, 3.1) + filt(pre, .5, .1, 9)
    rows = [('b', -56, 'o'), ('b', 56, 'o'), ('a', -30, 'm'), ('a', 30, 'm'), ('a', 0, 'm'), ('c', -14, 'f'), ('c', 14, 'f')]
    bl = bloom(pre, 50, 22, .33, rows=rows, filt_id=pre + 'hp', vw=1.2)[0]
    lft = ribbon(catmull([(41, 21), (33, 24), (24, 23), (17, 19), (14, 14), (17, 10), (22, 11), (23, 15)], 7), swell(.2, 1.0, .12, .35))
    rgt = ribbon(catmull([(59, 21), (67, 24), (76, 23), (83, 19), (86, 14), (83, 10), (78, 11), (77, 15)], 7), swell(.2, 1.0, .12, .35))
    lf1 = 'M38 22C32 19 26 19 21 22C26 25 33 25 38 23Z'
    lf2 = 'M62 22C68 19 74 19 79 22C74 25 67 25 62 23Z'
    body = ('<g fill="#B5822B"><path d="%s"/><path d="%s"/></g>' % (lft, rgt) + bl +
            '<circle cx="23.2" cy="15.4" r="1.3" fill="#B5822B"/><circle cx="76.8" cy="15.4" r="1.3" fill="#B5822B"/><circle cx="9" cy="14" r="1.1" fill="#C79A3A"/><circle cx="91" cy="14" r="1.1" fill="#C79A3A"/><circle cx="4" cy="14" r=".7" fill="#C79A3A"/><circle cx="96" cy="14" r=".7" fill="#C79A3A"/>')
    return svg(100, 28, '0 0 100 28', body, defs)

def encode(s):
    return urllib.parse.quote(s, safe="/:=,;'()- ").replace('"', "'")

def prune(sv):
    """drop <path id=...> defs that nothing references, and tidy"""
    import re
    for m in re.findall(r'<path id="([^"]+)"', sv):
        if ('#%s"' % m) not in sv:
            sv = re.sub(r'<path id="%s" d="[^"]*"/>' % re.escape(m), '', sv)
    return sv

def mirror(sv, w):
    i = sv.index('</defs>') + 7
    j = sv.rindex('</svg>')
    return sv[:i] + '<g transform="translate(%s 0) scale(-1 1)">' % w + sv[i:j] + '</g>' + sv[j:]

def recrop(sv, vb, w, h):
    import re
    sv = re.sub(r'width="[^"]*" height="[^"]*" viewBox="[^"]*"', 'width="%s" height="%s" viewBox="%s"' % (w, h, vb), sv, count=1)
    return sv

if __name__ == '__main__':
    out = {}
    out['crest'] = prune(crest())
    sp = prune(recrop(sprig(), '0 33 64 114', 64, 114))
    out['sprig_l'] = sp
    out['sprig_r'] = mirror(sp, 64)
    out['ornament'] = prune(ornament())
    for n, v in out.items():
        open(n + '.svg', 'w').write(v)
        print(n, len(v), len(encode(v)))
