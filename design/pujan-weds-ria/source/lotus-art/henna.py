import math,random
INK='#6E3512'
def f(v):return ('%.1f'%v).rstrip('0').rstrip('.')
def tr(pts,ang,ox,oy,sc=1,flip=1):
    c,s=math.cos(ang),math.sin(ang)
    return [(ox+(x*flip*c-y*s)*sc,oy+(x*flip*s+y*c)*sc) for x,y in pts]
def poly(pts,close=True):
    return 'M'+' L'.join('%s %s'%(f(x),f(y)) for x,y in pts)+('Z' if close else '')
def drop(L,w,bend,n=72):
    """teardrop pointing up (negative y), round bottom, bent tail"""
    pts=[]
    for i in range(n):
        t=2*math.pi*i/n
        x=math.sin(t)*math.sin(t/2)**1.2*w
        y=-(math.cos(t)*.5+.5)*L
        y2=-y/L
        x+=bend*L*(y2**2)
        pts.append((x,y))
    return pts
def leaf(L,w,n=40):
    right=[];left=[]
    for i in range(n+1):
        u=i/n;y=-u*L;ww=w*math.sin(math.pi*u**.82)
        right.append((ww,y));left.append((-ww,y))
    return right+left[::-1][1:-1]
def circle(cx,cy,r):return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="none"/>'%(f(cx),f(cy),f(r),INK)
def vine(W,H,seed,mirror=False):
    R=random.Random(seed);cy=H/2;A=H*.17;lam=R.uniform(520,640);ph=R.random()*6.28
    def Y(x):return cy+A*math.sin(2*math.pi*x/lam+ph)+A*.35*math.sin(2*math.pi*x/(lam*.43)+ph*2)
    def slope(x):return (Y(x+1)-Y(x-1))/2
    out=[];dots=[]
    out.append(poly([(x,Y(x)) for x in range(0,W+1,8)],False))
    # dotted companions
    for off in (-13,13):
        for x in range(10,W,13):
            dots.append(circle(x,Y(x)+off,1.2))
    x=60;side=1;k=0
    while x<W-70:
        ang=math.atan2(slope(x),1)
        ox,oy=x,Y(x)
        if k%5==2:
            # paisley / buta
            L=R.uniform(92,112);w=L*.40;a=ang-math.pi/2+side*.5
            body=drop(L,w,side*.30)
            out.append(poly(tr(body,a,ox,oy,1,1)))
            out.append(poly(tr(drop(L*.68,w*.64,side*.30),a,ox,oy-0,1,1)))
            # dots inside
            # a row of dots following the bend, between the two outlines
            for j in range(9):
                u=.12+j*.085;yy=-L*u*.86;xx=side*.30*L*(u*.86)**2*.62
                p=tr([(xx,yy)],a,ox,oy)[0];dots.append(circle(p[0],p[1],1.5))
            # fringe of small petals around the rim
            for j in range(11):
                u=.28+j*.065;yy=-(math.cos(2*math.pi*(1-u)*.5)*.5+.5)*L
                pass
            ring=tr([(side*.30*L*.12*.5,-L*.34)],a,ox,oy)[0]
            out.append('<circle cx="%s" cy="%s" r="6.5" />'%(f(ring[0]),f(ring[1])));dots.append(circle(ring[0],ring[1],1.8))
        elif k%5==4:
            # flower
            cx,cy2=ox,oy+side*36
            out.append('M%s %s L%s %s'%(f(ox),f(oy),f(cx),f(cy2)))
            for j in range(8):
                a=j*math.pi/4
                pet=tr(leaf(20,7.4),a+math.pi/2,cx,cy2,1,1)
                out.append(poly(pet))
            out.append('<circle cx="%s" cy="%s" r="5"/>'%(f(cx),f(cy2)));dots.append(circle(cx,cy2,1.3))
        else:
            L=R.uniform(48,64);w=L*.31;a=ang-math.pi/2+side*(.95+R.uniform(-.12,.12))
            lf=tr(leaf(L,w),a,ox,oy)
            out.append(poly(lf))
            tip=tr([(0,-L)],a,ox,oy)[0]
            out.append('M%s %s L%s %s'%(f(ox),f(oy),f(tip[0]),f(tip[1])))
            for j in (.35,.55,.75):
                p=tr([(side*w*.0,-L*j)],a,ox,oy)[0];dots.append(circle(p[0],p[1],1.2))
        if k%2==0:
            cxs=x+27;cs=side
            ys=Y(cxs);sp=[]
            for j in range(0,60):
                t=j/59;r=15*(1-t*.82);th=t*2*math.pi*1.45*cs+(-math.pi/2 if cs>0 else math.pi/2)
                sp.append((cxs+(r*math.cos(th))*1.0,ys-cs*(12+0)+r*math.sin(th)*cs))
            out.append(poly(sp,False));dots.append(circle(sp[-1][0],sp[-1][1],1.6))
        side=-side;k+=1;x+=R.uniform(50,64)
    body=''.join('<path d="%s"/>'%d if not d.startswith('<') else d for d in out)
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d"><g fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">%s</g>%s</svg>'%(W,H,W,H,INK,body,''.join(dots))
    if mirror: svg=svg.replace('<g fill','<g transform="translate(%d 0) scale(-1 1)"><g fill'%W,1).replace('</g>'+''.join(dots)+'</svg>','</g></g>'+'<g transform="translate(%d 0) scale(-1 1)">'%W+''.join(dots)+'</g></svg>')
    return svg
if __name__=='__main__':
    for n,(seed,mi) in {'a':(3,False),'b':(9,True),'c':(15,False)}.items():
        open('art/H_%s.svg'%n,'w').write(vine(1500,240,seed,mi))
    open('art/prevH.html','w').write('<body style="margin:0;background:#E8EBC8">'+''.join('<img src="H_%s.svg" style="display:block;width:1500px">'%n for n in 'abc')+'</body>')
