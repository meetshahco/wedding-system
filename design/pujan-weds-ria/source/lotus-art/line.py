"""Gold line art lotus set: a pen and ink study in the manner of Indian temple carving and block prints.
No colour fills. Petals are drawn as double contours with fine veins and bead dots; paper coloured fills only hide the lines behind."""
import math, sys
sys.path.insert(0, '.')
from art_painted import R, catmull, poly, ribbon, swell, petal_edge, svg, encode, prune, mirror, recrop

INK = '#9C6F1C'
INK2 = '#BF9540'
PAPER = '#FFFDF9'

def filt(pre, k=.8, f=.08, seed=3):
    return ('<filter id="%shp" x="-6%%" y="-6%%" width="112%%" height="112%%"><feTurbulence type="fractalNoise" baseFrequency="%s" numOctaves="2" seed="%s" result="n"/>'
            '<feDisplacementMap in="SourceGraphic" in2="n" scale="%s" xChannelSelector="R" yChannelSelector="G"/></filter>') % (pre, f, seed, k)

# ---- petals (local space: base 0,0, tip 0,-L)
def pedge(L, w, side, fl, bend):
    pts = [(0, 0), (.36 * w, -.07 * L), (.78 * w, -.2 * L), (.99 * w, -.38 * L), (.92 * w, -.56 * L), (.66 * w, -.74 * L), (.34 * w, -.88 * L), (.12 * w, -.962 * L), (fl, -L)]
    return [(side * x + bend * L * (y / L) ** 2, y) for x, y in pts]

def petal_defs(pre, protos, lw=1.0):
    d = ''
    for k, (L, w, fl) in protos.items():
        bend = {'b': .06, 'e': .09}.get(k, 0)
        right = catmull(pedge(L, w, 1, 0, bend), 4)
        left = catmull(pedge(L, w, -1, 0, bend), 4)
        body = poly(right + left[::-1][1:])
        wf = swell(.06 * lw, .95 * lw, .06 * lw, .48)
        outline = ribbon(right, wf) + ribbon(left, wf)
        sc = lambda pts: [(x * .6, y * .88 - .05 * L) for x, y in pts]
        wi = swell(.02, .34 * lw, .02, .5)
        inner = ribbon(sc(right), wi) + ribbon(sc(left), wi)
        vein = ''
        for f, ln in ((0, .66), (-1, .5), (1, .5)):
            vein += 'M%s %sC%s %s %s %s %s %s' % (R(f * .05 * w), R(-.07 * L), R(f * .12 * w), R(-.25 * L), R(f * .2 * w), R(-.42 * L), R(f * .1 * w), R(-ln * L))
        dots = ''.join('<circle cx="%s" cy="%s" r=".45"/>' % (R(x * w), R(-y * L)) for x, y in ((-.36, .17), (.36, .17), (-.2, .09), (.2, .09), (0, .26)))
        d += ('<path id="%sb%s" d="%s"/><path id="%so%s" d="%s"/><path id="%si%s" d="%s"/><path id="%sv%s" d="%s"/><g id="%sd%s">%s</g>' %
              (pre, k, body, pre, k, outline, pre, k, inner, pre, k, vein, pre, k, dots))
    return d

PROTOS = {'a': (46, 13.2, 0), 'b': (42, 12.6, 0), 'c': (33, 11.2, 0), 'e': (38, 12, 0)}

def petal_use(pre, k, tr):
    return ('<g transform="%s"><use xlink:href="#%sb%s" fill="%s" fill-opacity=".96"/><use xlink:href="#%si%s" fill="%s"/>'
            '<use xlink:href="#%sv%s" fill="none" stroke="%s" stroke-width=".36" stroke-linecap="round"/><use xlink:href="#%sd%s" fill="%s"/>'
            '<use xlink:href="#%so%s" fill="%s"/></g>') % (tr, pre, k, PAPER, pre, k, INK2, pre, k, INK2, pre, k, INK2, pre, k, INK)

ROWS = [('e', -74), ('e', 74), ('b', -54), ('b', 54), ('a', -34), ('a', 34), ('a', -11), ('a', 11), ('c', -44), ('c', 44), ('c', -20), ('c', 20), ('c', 0)]

def bloom(pre, cx, by, s=1.0, rows=None, filt_id=None):
    out = ''
    for k, ang in (rows or ROWS):
        a = math.radians(ang)
        bx = cx + math.sin(a) * 4 * s
        byy = by + (1 - math.cos(a)) * 6 * s
        out += petal_use(pre, k, 'translate(%s %s) rotate(%s) scale(%s)' % (R(bx), R(byy), R(ang), R(s)))
    # the cup the petals sit in
    cup = 'M%s %sQ%s %s %s %s' % (R(cx - 9 * s), R(by + 1 * s), R(cx), R(by + 9 * s), R(cx + 9 * s), R(by + 1 * s))
    pass
    return ('<g filter="url(#%s)">%s</g>' % (filt_id, out)) if filt_id else out

# ---- small drawing helpers
def tr_vine(pts, w, n=7, peak=.4):
    return ribbon(catmull(pts, n), swell(.15, w, .1, peak))

def leaf(pre, x, y, ln, ang, wid, ticks=3):
    """a pointed leaf with a midrib and side veins, base at x,y"""
    a = math.radians(ang)
    def P(u, v):
        return (x + u * math.sin(a) + v * math.cos(a), y - u * math.cos(a) + v * math.sin(a))
    pts_r = [P(0, 0), P(ln * .25, wid * .9), P(ln * .6, wid), P(ln * .9, wid * .4), P(ln, 0)]
    pts_l = [P(0, 0), P(ln * .25, -wid * .9), P(ln * .6, -wid), P(ln * .9, -wid * .4), P(ln, 0)]
    r = catmull(pts_r, 5); l = catmull(pts_l, 5)
    body = poly(r + l[::-1][1:])
    wf = swell(.06, .85, .05, .5)
    out = ribbon(r, wf) + ribbon(l, wf)
    rib = 'M%s %sL%s %s' % (R(P(0, 0)[0]), R(P(0, 0)[1]), R(P(ln * .92, 0)[0]), R(P(ln * .92, 0)[1]))
    vn = ''
    for i in range(1, ticks + 1):
        u = ln * (.12 + .6 * i / (ticks + .4))
        for sgn in (-1, 1):
            p0 = P(u, 0); p1 = P(u + ln * .17, sgn * wid * .72 * (1 - i / (ticks + 2) * .5))
            vn += 'M%s %sL%s %s' % (R(p0[0]), R(p0[1]), R(p1[0]), R(p1[1]))
    return ('<path d="%s" fill="%s"/><path d="%s" fill="none" stroke="%s" stroke-width=".36"/><path d="%s" fill="none" stroke="%s" stroke-width=".3" stroke-linecap="round"/><path d="%s" fill="%s"/>'
            % (body, PAPER, rib, INK2, vn, INK2, out, INK))

def beads(pts, r=.8, col=INK2):
    return ''.join('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (R(x), R(y), R(r), col) for x, y in pts)

def halo_petals(cx, cy, r0, r1, n, a0, a1, wid):
    """a half mandala: a ring of slender pointed petals radiating from cx,cy, drawn as fine pen lines"""
    out = ''
    ink = ''
    for i in range(n):
        t = i / (n - 1)
        a = math.radians(a0 + (a1 - a0) * t)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        def P(r, o):
            return (cx + ux * r + nx * o, cy + uy * r + ny * o)
        m = (r0 + r1) / 2
        l = [P(r0, 0), P(r0 + (m - r0) * .55, -wid), P(m + (r1 - m) * .5, -wid * .7), P(r1, 0)]
        r_ = [P(r0, 0), P(r0 + (m - r0) * .55, wid), P(m + (r1 - m) * .5, wid * .7), P(r1, 0)]
        ll = catmull(l, 4); rr = catmull(r_, 4)
        wf = swell(.05, .5, .05, .5)
        out += ribbon(ll, wf) + ribbon(rr, wf)
        c0, c1 = P(r0 + 1.6, 0), P(r1 - 3, 0)
        ink += 'M%s %sL%s %s' % (R(c0[0]), R(c0[1]), R(c1[0]), R(c1[1]))
    return '<path d="%s" fill="%s"/><path d="%s" fill="none" stroke="%s" stroke-width=".3" stroke-linecap="round"/>' % (out, INK, ink, INK2)

def arc_beads(cx, cy, r, a0, a1, n, r0=.7, r1=1.3):
    pts = []
    out = ''
    for i in range(n):
        t = i / (n - 1)
        a = math.radians(a0 + (a1 - a0) * t)
        rr = r0 + (r1 - r0) * (1 - abs(t - .5) * 2)
        out += '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (R(cx + r * math.cos(a)), R(cy + r * math.sin(a)), R(rr), INK2)
    return out

# ---------------------------------------------------------------- crest (120 x 92)
def crest():
    p = 'c'
    defs = filt(p, .7, .09, 7) + petal_defs(p, PROTOS)
    cx, cy = 60, 80
    halo = (halo_petals(cx, cy, 36, 56, 13, 190, 350, 4.4) + arc_beads(cx, cy, 60.5, 192, 348, 27) +
            arc_beads(cx, cy, 33, 196, 344, 15, .5, .8))
    bl = bloom(p, 60, 74, .72, filt_id=p + 'hp')
    lv = leaf(p, 47, 84, 24, -84, 5.4, 4) + leaf(p, 73, 84, 24, 84, 5.4, 4) + leaf(p, 36, 86, 17, -70, 3.8, 3) + leaf(p, 84, 86, 17, 70, 3.8, 3)
    base = '<path d="M30 91.5Q60 96 90 91.5" fill="none" stroke="%s" stroke-width=".8" stroke-linecap="round"/>' % INK + beads([(60, 93.6), (52, 93.2), (68, 93.2), (44, 92.3), (76, 92.3)], .6)
    body = '<g filter="url(#%shp)">%s</g>' % (p, halo + lv) + bl + base
    return svg(120, 94, '0 0 120 94', body, defs)

# ---------------------------------------------------------------- corner sprig (64 x 114 after crop)
def pad_leaf(cx, cy, rx, ry, pre):
    """a lotus leaf lying on the water: a wide oval with a notch, veins radiating from the stalk and a scalloped rim"""
    pts = []
    for i in range(0, 73):
        t = math.radians(i * 5)
        sc = 1 + .018 * math.sin(i * 2.2)
        pts.append((cx + math.cos(t) * rx * sc, cy + math.sin(t) * ry * sc))
    keep = pts[:5] + pts[9:]
    d = 'M' + ' L'.join('%s %s' % (R(x), R(y)) for x, y in keep[:5]) + ' L%s %s L' % (R(cx + rx * .18), R(cy + ry * .06)) + ' L'.join('%s %s' % (R(x), R(y)) for x, y in keep[5:]) + 'Z'
    vs = ''
    for k in range(0, 360, 26):
        t = math.radians(k + 6)
        vs += 'M%s %sL%s %s' % (R(cx), R(cy), R(cx + math.cos(t) * rx * 1.3), R(cy + math.sin(t) * ry * 1.3))
    return ('<clipPath id="%scp"><path d="%s"/></clipPath><path d="%s" fill="%s"/><path d="%s" clip-path="url(#%scp)" fill="none" stroke="%s" stroke-width=".4" stroke-linecap="round"/>'
            '<path d="%s" fill="none" stroke="%s" stroke-width=".85" stroke-linejoin="round"/>') % (pre, d, d, PAPER, vs, pre, INK2, d, INK)

def prickles(pts, every=7):
    out = ''
    s = catmull(pts, 12)
    for i in range(6, len(s) - 4, every):
        x0, y0 = s[i]; x1, y1 = s[i + 1]
        dx, dy = x1 - x0, y1 - y0; l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        sg = 1 if (i // every) % 2 else -1
        out += 'M%s %sL%s %s' % (R(x0), R(y0), R(x0 + nx * 2.1 * sg + dx / l * .9), R(y0 + ny * 2.1 * sg + dy / l * .9))
    return '<path d="%s" fill="none" stroke="%s" stroke-width=".5" stroke-linecap="round"/>' % (out, INK)

def sprig():
    pre = 's'
    defs = filt(pre, .6, .09, 5) + petal_defs(pre, PROTOS, 1.7)
    main = [(16, 138), (12, 124), (15, 108), (25, 92), (36, 79)]
    br = [(14.5, 113), (26, 109), (39, 104), (50, 98)]
    curl = [(13, 120), (6, 116), (2.5, 109), (3.5, 102), (8, 100), (10.5, 104), (9, 108)]
    body = (pad_leaf(18, 139, 17.5, 6.2, pre) +
            '<path d="%s" fill="%s"/>' % (tr_vine(main, 1.5, 8, .35), INK) + prickles(main) +
            '<path d="%s" fill="%s"/>' % (tr_vine(br, 1.1, 8, .3), INK) + prickles(br, 9) +
            '<path d="%s" fill="%s"/><circle cx="9" cy="108.2" r="1.4" fill="%s"/>' % (tr_vine(curl, 1.15, 7, .3), INK, INK) +
            bloom(pre, 37, 78, .62, filt_id=pre + 'hp') +
            bud(pre, 51, 99, .46) +
            beads([(23, 45), (52, 50), (37.5, 36), (30, 39), (45, 40)], .9))
    return svg(70, 146, '0 0 70 146', body, defs)

def bud(pre, cx, cy, s):
    rows = [('b', -17), ('b', 17), ('a', 0)]
    calyx = ''
    for sg in (-1, 1):
        calyx += 'M%s %sC%s %s %s %s %s %s' % (R(cx), R(cy + 1.4), R(cx + sg * 5 * s), R(cy + 3 * s), R(cx + sg * 9 * s), R(cy - 1 * s), R(cx + sg * 8.5 * s), R(cy - 8 * s))
    return bloom(pre, cx, cy, s, rows=rows, filt_id=pre + 'hp') + '<path d="%s" fill="none" stroke="%s" stroke-width=".7" stroke-linecap="round"/>' % (calyx, INK)

# ---------------------------------------------------------------- divider ornament (100 x 28)
def ornament():
    pre = 'o'
    defs = filt(pre, .45, .1, 9) + petal_defs(pre, PROTOS, 2.6)
    rows = [('b', -58), ('b', 58), ('a', -32), ('a', 32), ('a', 0), ('c', -14), ('c', 14)]
    bl = bloom(pre, 50, 22, .3, rows=rows, filt_id=pre + 'hp')
    sl = [(41, 22), (33, 25), (25, 24), (18, 20), (15, 14), (18, 10), (23, 11), (24, 15)]
    sl2 = [(41, 20.5), (35, 15), (29, 11), (22, 7.5), (16, 6.5)]
    sr = [(100 - x, y) for x, y in sl]; sr2 = [(100 - x, y) for x, y in sl2]
    body = ('<path d="%s" fill="%s"/><path d="%s" fill="%s"/><path d="%s" fill="%s"/><path d="%s" fill="%s"/>' % (tr_vine(sl, .85), INK, tr_vine(sr, .85), INK, tr_vine(sl2, .7, 6), INK, tr_vine(sr2, .7, 6), INK) +
            leaf(pre, 36, 22.5, 9, -108, 2.3, 2) + leaf(pre, 64, 22.5, 9, 108, 2.3, 2) + leaf(pre, 31, 17, 7, -58, 1.9, 2) + leaf(pre, 69, 17, 7, 58, 1.9, 2) + bl +
            beads([(24, 15.2), (76, 15.2)], 1.2, INK) + beads([(9, 14), (91, 14)], 1.0) + beads([(4, 14), (96, 14)], .65) + beads([(16, 6.5), (84, 6.5)], .8) +
            '<path d="M50 3.6l1.6 1.6l-1.6 1.6l-1.6-1.6z" fill="%s"/>' % INK)
    return svg(100, 28, '0 0 100 28', body, defs)

if __name__ == '__main__':
    out = {}
    out['crest'] = prune(crest())
    sp = prune(recrop(sprig(), '0 33 64 114', 64, 114))
    out['sprig_l'] = sp
    out['sprig_r'] = mirror(sp, 64)
    out['ornament'] = prune(ornament())
    for n, v in out.items():
        open('L_' + n + '.svg', 'w').write(v)
        print(n, len(v), len(encode(v)))
