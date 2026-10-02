import bpy, numpy as np, sys, glob, os
args=sys.argv[sys.argv.index('--')+1:]; out=args[0]; files=args[1:]
cell=420; cols=4; rows=(len(files)+cols-1)//cols
W=cols*cell; H=rows*cell
canvas=np.zeros((H,W,4),dtype=np.float32); canvas[...,:3]=0.25; canvas[...,3]=1
for k,f in enumerate(files):
    im=bpy.data.images.load(f); w,h=im.size
    px=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)
    s=min(cell/w,cell/h); nw,nh=max(1,int(w*s)),max(1,int(h*s))
    ys=(np.arange(nh)/s).astype(int).clip(0,h-1); xs=(np.arange(nw)/s).astype(int).clip(0,w-1)
    small=px[ys][:,xs]
    r,c=divmod(k,cols); oy=H-(r+1)*cell; ox=c*cell
    a=small[...,3:4]
    reg=canvas[oy:oy+nh, ox:ox+nw]
    reg[...,:3]=small[...,:3]*a+reg[...,:3]*(1-a)
img=bpy.data.images.new('m',W,H,alpha=True); img.pixels=canvas.ravel()
img.filepath_raw=out; img.file_format='PNG'; img.save()
