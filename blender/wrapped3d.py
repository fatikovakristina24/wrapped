# WRAPPED — 3D system. One unit ("token" = one listening / one day): a bevelled disc.
# Every chapter re-arranges the same tokens: DATA -> STORY -> MEMORY.
# usage: Blender -b --factory-startup --python wrapped3d.py -- <scene> [preview]
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, noise

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = ARGS[0] if ARGS else 'hero'
PREVIEW = 'preview' in ARGS
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'renders')
HDRI_DIR = '/Applications/Blender.app/Contents/Resources/5.0/datafiles/studiolights/world/'

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)

ULTRA, ULTRA_L, INK, WHITE, FOG, HAZE = '#1F2BFF', '#A9B2FF', '#0A0A0B', '#F3F3F0', '#DFE1E4', '#E3E6FF'

# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup(w, h, samples=128, transparent=True, glass=False, bg=None):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'METAL'; p.get_devices()
    for d in p.devices: d.use = d.type == 'METAL'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 24 if PREVIEW else samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 12; sc.cycles.glossy_bounces = 6; sc.cycles.transmission_bounces = 12
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.render.resolution_percentage = 30 if PREVIEW else 100
    sc.render.film_transparent = transparent
    sc.cycles.film_transparent_glass = glass
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e:
        print('look', e)
    sc.render.image_settings.file_format = 'PNG' if PREVIEW else 'WEBP'
    sc.render.image_settings.color_mode = 'RGBA'
    if not PREVIEW: sc.render.image_settings.quality = 92
    world = bpy.data.worlds.new('W'); sc.world = world
    try: world.use_nodes = True
    except Exception: pass
    return sc

def world_hdri(name='studio.exr', strength=0.6, rot=0.0, bg=None):
    w = bpy.context.scene.world; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI_DIR + name)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = rot
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    bgn = nt.nodes.new('ShaderNodeBackground'); bgn.inputs['Strength'].default_value = strength
    nt.links.new(env.outputs['Color'], bgn.inputs['Color'])
    if bg is None:
        nt.links.new(bgn.outputs['Background'], out.inputs['Surface'])
    else:  # camera sees flat colour, everything else sees the HDRI
        cam_bg = nt.nodes.new('ShaderNodeBackground'); cam_bg.inputs['Color'].default_value = lin(bg); cam_bg.inputs['Strength'].default_value = 1
        lp = nt.nodes.new('ShaderNodeLightPath'); mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
        nt.links.new(bgn.outputs['Background'], mix.inputs[1]); nt.links.new(cam_bg.outputs['Background'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def camera(loc, target, lens=50, shift=(0, 0), fstop=None, focus=None):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.shift_x, cd.shift_y = shift
    cd.clip_end = 500
    if fstop:
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = focus or (Vector(target) - Vector(loc)).length
    ob = bpy.data.objects.new('cam', cd); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; look_at(ob, target); bpy.context.scene.camera = ob
    return ob

def area(loc, target, energy, color='#FFFFFF', size=6, shape='RECTANGLE', size_y=None):
    ld = bpy.data.lights.new('L', 'AREA'); ld.energy = energy; ld.color = lin(color)[:3]
    ld.shape = shape; ld.size = size; ld.size_y = size_y or size
    ob = bpy.data.objects.new('L', ld); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; look_at(ob, target)
    try: ob.visible_camera = False
    except Exception: pass
    return ob

def rig(k=1.0, acid=1.0, infra=1.0, cold=False):
    """Signature light: white key + ultramarine rim (story) + pale-ultramarine rim (memory)."""
    area((7, -9, 10), (0, 0, 0), 2200 * k, '#FFF6EC', 9)
    area((-11, -2, 4), (0, 0, 0), 900 * k, '#FFFFFF', 3, size_y=14)  # strip -> long chrome highlight
    area((0, 2, 15), (0, 0, 0), 1800 * k, '#FFFFFF', 16)               # overhead softbox -> silver tops
    area((2, -16, -2), (0, 0, 0), 500 * k, '#FFFFFF', 18, size_y=4)     # floor bounce card
    if acid: area((-8, 9, 2), (0, 0, 0), 1700 * acid, '#1F2BFF' if not cold else '#DDE3F0', 8)
    if infra: area((10, 7, -3), (0, 0, 0), 1100 * infra, '#A9B2FF' if not cold else '#B9C3CC', 8)

# ---------------------------------------------------------------- materials
MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes['Principled BSDF']; I = b.inputs
    def s(k, v): I[k].default_value = v
    if name == 'chrome':
        s('Base Color', lin('#E9E6E1')); s('Metallic', 1); s('Roughness', 0.07)
    elif name == 'chrome_soft':
        s('Base Color', lin('#D6D8DA')); s('Metallic', 1); s('Roughness', 0.22)
    elif name == 'ultra':
        s('Base Color', lin(ULTRA)); s('Roughness', 0.16); s('Coat Weight', 1); s('Coat Roughness', 0.02)
        s('Emission Color', lin(ULTRA)); s('Emission Strength', 0.6)
    elif name == 'pearl':
        s('Base Color', lin(WHITE)); s('Roughness', 0.14); s('Coat Weight', 1); s('Coat Roughness', 0.02); s('Subsurface Weight', 0.2)
    elif name == 'graphite':
        s('Base Color', lin('#161616')); s('Roughness', 0.12); s('Coat Weight', 1); s('Coat Roughness', 0.02)
    elif name == 'paper':
        s('Base Color', lin('#F3F3F0')); s('Roughness', 0.35); s('Coat Weight', 0.6); s('Subsurface Weight', 0.1)
    elif name == 'clay':
        s('Base Color', lin('#D3D6D8')); s('Roughness', 0.55)
    elif name == 'clay_dark':
        s('Base Color', lin('#8E959A')); s('Roughness', 0.5)
    elif name == 'wire':
        s('Base Color', lin('#F4F7F9')); s('Transmission Weight', 1); s('Roughness', 0.12); s('IOR', 1.3)
    elif name == 'glass':
        s('Base Color', lin('#FFF1E6')); s('Transmission Weight', 1); s('Roughness', 0.02); s('IOR', 1.45)
    elif name == 'glass_warm':
        s('Base Color', lin('#EEF0FF')); s('Transmission Weight', 1); s('Roughness', 0.04); s('IOR', 1.5)
        s('Coat Weight', 0.5); s('Thin Film Thickness', 380); s('Thin Film IOR', 1.35)
    elif name == 'glass_acid':
        s('Base Color', lin('#C9CEFF')); s('Transmission Weight', 1); s('Roughness', 0.05); s('IOR', 1.45)
    MATS[name] = m
    return m

# ---------------------------------------------------------------- token geometry
MESHES = {}
def token_mesh(matname, segs=56, bevel=0.22, wire=False):
    key = (matname, wire)
    if key in MESHES: return MESHES[key]
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=1, radius2=1, depth=1)
    rim = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
    bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=5, profile=0.5, affect='EDGES')
    for f in bm.faces:
        f.smooth = abs(f.normal.z) < 0.999
    me = bpy.data.meshes.new('token_' + matname); bm.to_mesh(me); bm.free()
    me.materials.append(mat(matname))
    MESHES[key] = me
    return me

COLL = None
def coll(name):
    c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); return c

def basis(zdir, xhint=None):
    z = Vector(zdir).normalized()
    x = Vector(xhint) if xhint is not None else (Vector((0, 0, 1)) if abs(z.z) < 0.9 else Vector((1, 0, 0)))
    x = (x - z * x.dot(z))
    if x.length < 1e-6: x = Vector((1, 0, 0)) - z * z.x
    x.normalize(); y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()

def token(loc, zdir, radius, thick, matname, xhint=None, c=None, wire=False, rot=None):
    me = token_mesh(matname, wire=wire)
    ob = bpy.data.objects.new('tk', me)
    R = rot.to_matrix().to_4x4() if rot is not None else basis(zdir, xhint)
    # bevel is in unit space; thick discs keep proportion via scale
    ob.matrix_world = Matrix.Translation(Vector(loc)) @ R @ Matrix.Diagonal((radius, radius, thick, 1))
    (c or bpy.context.scene.collection).objects.link(ob)
    if wire:
        m = ob.modifiers.new('w', 'WIREFRAME'); m.thickness = 0.012 / max(thick, 0.02); m.use_relative_offset = False
    return ob

def rand_rot(rng):
    from mathutils import Euler
    return Euler((rng.uniform(0, 6.283), rng.uniform(0, 6.283), rng.uniform(0, 6.283)))

def year_values(n=365, seed=7):
    """Listening minutes per day: seasons + weekends + a few obsessive days."""
    rng = random.Random(seed); v = []
    for d in range(n):
        t = d / n
        base = 0.42 + 0.18 * math.sin(t * 6.283 * 2 + 0.6) + 0.12 * math.sin(t * 6.283 * 7.3)
        base += 0.22 * noise.noise(Vector((t * 9, 0.3, 0.7)))
        if d % 7 in (5, 6): base += 0.12
        if d > 330: base += 0.2 * (d - 330) / 35   # december build-up
        if rng.random() < 0.05: base += rng.uniform(0.25, 0.5)
        v.append(max(0.06, base + rng.uniform(-0.06, 0.06)))
    mx = max(v); return [x / mx for x in v]

def pick_mat(v, rng, top=False):
    if top: return 'pearl'
    if v > 0.82: return 'ultra'
    r = rng.random()
    return 'graphite' if r < 0.18 else 'chrome'

def render(name):
    sc = bpy.context.scene
    sc.render.filepath = os.path.join(OUT, ('_prev_' if PREVIEW else '') + name)
    bpy.ops.render.render(write_still=True)

def split_front(objs, test, name):
    """Second pass: only the tokens nearest to camera -> foreground layer above the type."""
    for o in objs:
        o.hide_render = not test(o)
    render(name)
    for o in objs: o.hide_render = False

# ================================================================= SCENES
def ring_points(n, R, start=0.0, span=2 * math.pi):
    for i in range(n):
        th = start + span * i / n
        yield i, th, Vector((R * math.cos(th), R * math.sin(th), 0)), Vector((-math.sin(th), math.cos(th), 0))

def s_hero():
    """00 — DATA in flight: tokens stream in and begin to stack into the ring of the year."""
    setup(2880, 1800, 110); world_hdri('studio.exr', 0.9, 1.2); rig(1.0, 1.1, 1.0)
    rng = random.Random(3); vals = year_values(365); objs = []
    R = 6.0; n = 365
    for i, th, p, t in ring_points(n, R, math.radians(-150)):
        # ring is assembled over ~60% of the loop, the rest is still "raw data"
        u = i / n
        chaos = 0 if u < 0.58 else ((u - 0.58) / 0.42) ** 1.4
        v = vals[i]; r = 0.45 + 1.05 * v; th_k = 0.05
        if chaos == 0:
            objs.append(token(p, t, r, th_k, pick_mat(v, rng, i == 240), xhint=p))
        else:
            k = 1 + 3 * chaos
            for _ in range(int(k)):
                off = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 0.8))) * (chaos * 5.5)
                q = p + off + t * chaos * rng.uniform(0, 4)
                sc = r * (1 - 0.55 * chaos) * rng.uniform(0.5, 1.1)
                objs.append(token(q, t, sc, th_k * rng.uniform(1, 2.5), pick_mat(v, rng), rot=rand_rot(rng) if rng.random() < chaos else None, xhint=p))
    # far dust: single plays, not yet counted
    for _ in range(420):
        q = Vector((rng.uniform(-22, 22), rng.uniform(-6, 30), rng.uniform(-10, 12)))
        objs.append(token(q, (0, 0, 1), rng.uniform(0.06, 0.22), 0.04, 'chrome' if rng.random() < .75 else 'ultra', rot=rand_rot(rng)))
    camera((3.4, -17.5, 6.4), (1.0, 0.8, -0.8), 38, (0.0, 0.0), fstop=2.2, focus=16.5)
    render('hero_ring')
    split_front(objs, lambda o: o.matrix_world.translation.y < -1.0, 'hero_ring_front')

def s_ring365():
    """01 — the full year: 365 discs stacked into one loop. Disc diameter = minutes that day."""
    setup(2880, 2160, 110); world_hdri('studio.exr', 0.35, 2.2); rig(1.0, 1.0, 1.0)
    rng = random.Random(11); vals = year_values(365); objs = []
    R = 6.0; top = max(range(365), key=lambda i: vals[i])
    for i, th, p, t in ring_points(365, R, math.radians(90)):
        v = vals[i]
        objs.append(token(p, t, 0.35 + 1.25 * v, 0.055, pick_mat(v, rng, i == top), xhint=p))
    camera((0.0, -13.0, 9.5), (0.0, -0.6, -0.4), 40)
    render('ring365')
    split_front(objs, lambda o: o.matrix_world.translation.y < -2.2, 'ring365_front')

def s_history():
    """02 — evolution: 2015 a plain loop; 2016 the loop starts to breathe; today it knots into a story."""
    for era in ('2015', '2016', 'now'):
        reset(); MATS.clear(); MESHES.clear()
        setup(1800, 1800, 160); world_hdri('studio.exr', 0.4, 0.8); rig(1.0, 0.9 if era != '2015' else 0.2, 0.9 if era == 'now' else 0.1)
        rng = random.Random(5)
        if era == '2015':
            for i, th, p, t in ring_points(52, 4.2):
                token(p, t, 0.55, 0.16, 'graphite' if i % 13 else 'chrome_soft', xhint=p)
        elif era == '2016':
            vals = year_values(140, 2)
            for i, th, p, t in ring_points(140, 4.2):
                v = vals[i]; p = p + Vector((0, 0, 0.5 * math.sin(th * 3)))
                token(p, t, 0.3 + 0.9 * v, 0.07, 'ultra' if v > .86 else ('chrome' if i % 3 else 'graphite'), xhint=p)
        else:  # (2,3) torus knot of 620 tokens
            n = 620; vals = year_values(n, 9)
            def knot(s):
                a = 2 * math.pi * s
                r = 3.4 + 1.5 * math.cos(3 * a)
                return Vector((r * math.cos(2 * a), r * math.sin(2 * a), 1.6 * math.sin(3 * a)))
            for i in range(n):
                s = i / n; p = knot(s); t = (knot(s + 1e-4) - p).normalized(); v = vals[i]
                m = 'pearl' if v > .93 else ('ultra' if v > .78 else ('graphite' if rng.random() < .2 else 'chrome'))
                token(p, t, 0.22 + 0.75 * v, 0.045, m, xhint=p - Vector((0, 0, p.z)))
        camera((0, -12.5, 7.5), (0, 0, -0.3), 50)
        render('history_' + era)

def s_data():
    """03 — maximal structure. Same token, four data organisms."""
    # MINUTES: one long coil of time
    reset(); MATS.clear(); MESHES.clear()
    setup(1200, 2400, 128); world_hdri('studio.exr', 0.45, 0.4); rig(1.0, 0.8, 0.4)
    n = 900; rng = random.Random(1)
    for i in range(n):
        s = i / n; a = s * 2 * math.pi * 11; h = -7 + 14 * s
        p = Vector((1.9 * math.cos(a), 1.9 * math.sin(a), h)); t = Vector((-math.sin(a), math.cos(a), 14 / (2 * math.pi * 11 * 1.9))).normalized()
        token(p, t, 0.62, 0.035, 'ultra' if (i % 90) > 82 else ('chrome' if s > 0.15 else 'graphite'), xhint=p - Vector((0, 0, h)))
    camera((0, -27, 2.5), (0, 0, 0.2), 55)
    render('data_minutes')
    # TRACKS: a city block of 1 284 stacked plays
    reset(); MATS.clear(); MESHES.clear()
    setup(1800, 1500, 128); world_hdri('studio.exr', 0.45, 0.4); rig(1.0, 0.8, 0.5)
    rng = random.Random(4); cnt = 0
    for gx in range(12):
        for gy in range(12):
            hgt = int(2 + 13 * (0.5 + 0.5 * noise.noise(Vector((gx * .23, gy * .23, .5)))) ** 1.6)
            for gz in range(hgt):
                if cnt >= 1284: break
                cnt += 1
                top = gz == hgt - 1 and hgt >= 10
                token((gx * 0.62 - 3.4, gy * 0.62 - 3.4, gz * 0.17), (0, 0, 1), 0.27, 0.13, 'ultra' if top else ('chrome' if (gx + gy) % 5 else 'graphite'))
    camera((9.5, -9.5, 8.8), (0, 0, 0.4), 50)
    render('data_tracks')
    # ARTISTS: a planet of 347 scales, a few giants
    reset(); MATS.clear(); MESHES.clear()
    setup(1600, 1600, 128); world_hdri('studio.exr', 0.45, 0.4); rig(1.0, 0.9, 0.7)
    rng = random.Random(8); n = 347; ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - 2 * (i + .5) / n; rr = math.sqrt(1 - y * y); th = ga * i
        d = Vector((math.cos(th) * rr, y, math.sin(th) * rr)); big = rng.random() < 0.035
        token(d * (3.0 + (0.25 if big else 0)), d, 0.62 if big else rng.uniform(0.2, 0.36), 0.06, 'ultra' if big else ('graphite' if rng.random() < .25 else 'chrome'))
    camera((0, -11.5, 2.5), (0, 0, 0), 50)
    render('data_artists')
    # GENRES: the loop sliced into 86 genre segments, height = share
    reset(); MATS.clear(); MESHES.clear()
    setup(1800, 1300, 128); world_hdri('studio.exr', 0.45, 0.4); rig(1.0, 0.8, 0.8)
    rng = random.Random(12); n = 86; shares = sorted([rng.paretovariate(1.6) for _ in range(n)], reverse=True)
    mx = shares[0]
    for i in range(n):
        th = 2 * math.pi * i / n; p = Vector((4 * math.cos(th), 4 * math.sin(th), 0)); hgt = 0.15 + 2.6 * (shares[i] / mx) ** 0.6
        layers = max(1, int(hgt / 0.12))
        m = 'ultra' if i < 3 else ('pearl' if i < 6 else ('chrome' if i % 4 else 'graphite'))
        for k in range(layers):
            token(p + Vector((0, 0, k * 0.12)), (0, 0, 1), 0.2, 0.08, m)
    camera((0, -10.5, 8.0), (0, 0, 0.5), 48)
    render('data_genres')

def s_lab():
    """04 — exploded specimen: one token separated into the four layers of design."""
    setup(2000, 2400, 256, glass=True); world_hdri('studio.exr', 0.5, 1.0); rig(1.1, 1.0, 1.0)
    layers = [('chrome', 0), ('glass_acid', 1), ('graphite', 2), ('ultra', 3)]
    for m, k in layers:
        token((0, 0, -4.2 + k * 2.6), (0, 0, 1), 3.2, 0.32, m)
    # MOTION: the bottom layer sheds tokens -> trail
    rng = random.Random(2)
    for i in range(90):
        a = rng.uniform(0, 2 * math.pi); r = 3.6 + rng.expovariate(0.6)
        token((r * math.cos(a), r * math.sin(a), -4.2 + rng.gauss(0, 0.3)), (0, 0, 1), rng.uniform(0.1, 0.35), 0.06, 'chrome', rot=rand_rot(rng))
    # GRAPHICS: grid of micro tokens floating on the glass layer
    for gx in range(-4, 5):
        for gy in range(-4, 5):
            if gx * gx + gy * gy <= 16 and (gx + gy) % 2 == 0:
                token((gx * 0.62, gy * 0.62, -4.2 + 2.6 + 0.35), (0, 0, 1), 0.18, 0.12, 'pearl')
    camera((10.5, -10.5, 7.5), (0, 0, -0.4), 50)
    render('lab_stack')

def s_story():
    """05 — the loop unrolled into a path; five beats along it."""
    setup(3600, 1300, 110); world_hdri('studio.exr', 0.4, 0.6); rig(1.0, 0.9, 1.1)
    rng = random.Random(6); n = 520; vals = year_values(n, 4)
    def path(s):
        return Vector((-15 + 30 * s, 3.2 * math.sin(s * math.pi * 2.0), 1.8 * math.sin(s * math.pi * 3.0 + .5)))
    beats = [0.06, 0.28, 0.5, 0.72, 0.94]
    for i in range(n):
        s = i / n; p = path(s); t = (path(s + 1e-4) - p).normalized(); v = vals[i]
        near = min(abs(s - b) for b in beats)
        if near < 0.004:
            m, r = ('pearl' if s > 0.9 else 'ultra'), 2.4
        else:
            m = 'pearl' if (v > .88 and s > .5) else ('ultra' if v > .9 else ('graphite' if rng.random() < .22 else 'chrome'))
            r = 0.55 + 1.3 * v * (0.6 + 0.6 * s)
        token(p, t, r, 0.05, m, xhint=Vector((0, 0, 1)))
    camera((0, -31, 8.0), (0, 0, -0.4), 46, fstop=4.0)
    render('story_path')

def s_social():
    """06 — the result leaves the person: the loop copies itself and spreads."""
    setup(2880, 2200, 110); world_hdri('studio.exr', 0.5, 2.0); rig(1.0, 1.0, 0.0)
    area((0, -6, -9), (0, 0, 0), 900, '#FFFFFF', 10)
    rng = random.Random(21)
    rings = [((0, 0, 0), 3.2, (0.3, 0.2, 0)), ((-9, 6, 3), 1.8, (1.1, 0.5, 0.2)), ((8.5, 4, 4), 2.2, (-0.6, 0.9, 0.1)),
             ((-6.5, -2, -4), 1.4, (0.2, -1.0, 0.4)), ((6, -3, -3.5), 1.2, (1.4, 0.3, -0.3)), ((-12, 12, -2), 2.4, (0.8, 0.8, 0.8)),
             ((13, 14, -1), 2.8, (-0.2, 1.3, 0.3)), ((1, 10, 6), 1.6, (1.2, -0.4, 0.5)), ((-3, -5, 5), 0.9, (0.4, 1.5, 0.0))]
    from mathutils import Euler
    for (c, R, e) in rings:
        rotm = Euler(e).to_matrix(); n = int(70 * R); vals = year_values(n, int(R * 10))
        for i, th, p, t in ring_points(n, R):
            v = vals[i]; m = 'ultra' if v > .8 else ('graphite' if rng.random() < .35 else 'chrome')
            token(Vector(c) + rotm @ p, rotm @ t, (0.1 + 0.42 * v) * (R / 3.2) ** 0.4, 0.035 * (R / 3.2) ** 0.4 + 0.012, m, xhint=rotm @ p)
    for _ in range(600):  # burst
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized(); r = 3.5 + rng.expovariate(0.12)
        token(d * r, d, rng.uniform(0.08, 0.3), 0.05, rng.choice(['chrome', 'chrome', 'graphite', 'ultra', 'paper']), rot=rand_rot(rng))
    camera((0, -17, 2.5), (0, 0, 0), 38, fstop=2.0)
    render('social_spread')

def s_algo():
    """07 — the system counts, but does not know why. The loop loses its matter."""
    setup(2880, 2000, 128, glass=True); world_hdri('studio.exr', 0.7, 0.3); rig(1.0, 0.5, 0.5, cold=True)
    rng = random.Random(31); vals = year_values(365); objs = []
    R = 6.0
    for i, th, p, t in ring_points(365, R, math.radians(200)):
        u = i / 365; v = vals[i]; r = 0.35 + 1.25 * v
        if u < 0.42:
            token(p, t, r, 0.055, 'clay' if i % 9 else 'clay_dark', xhint=p)
        elif u < 0.7:
            token(p, t, r, 0.055, 'wire', xhint=p)
        elif u < 0.78:
            if rng.random() < 0.5:
                token(p, t, r, 0.055, 'wire', xhint=p)
        else:  # missing context: tokens drop out of the loop
            f = (u - 0.78) / 0.22
            if rng.random() < 0.55:
                q = p + Vector((rng.gauss(0, .9), rng.gauss(0, .9), -rng.uniform(0, 1) * 5.5 * f))
                token(q, t, r * rng.uniform(.4, 1), 0.055, 'clay', rot=rand_rot(rng) if rng.random() < f else None, xhint=p)
    camera((-1.5, -14.5, 6.5), (0.4, 0, -1.4), 42)
    render('algo_broken')

def s_final():
    """08 — memory: the loop melts into one continuous body; the days stay inside like light in amber."""
    setup(2400, 2000, 220, transparent=False); world_hdri('studio.exr', 1.0, 2.5, bg=HAZE)
    area((0, 9, 3), (0, 0, 0), 1800, '#A9B2FF', 9)
    area((-9, -4, 7), (0, 0, 0), 900, '#FFFFFF', 6)
    area((8, -2, -4), (0, 0, 0), 1200, '#1F2BFF', 5)
    area((0, -2, 10), (0, 0, 0), 600, '#FFFFFF', 12)
    area((0, 0, -9), (0, 0, 0), 1100, '#EEF0FF', 22)   # light from below: no dark core in the glass
    bpy.context.scene.view_settings.view_transform = 'Standard'
    # organic loop: torus with noise + gentle twist
    bpy.ops.mesh.primitive_torus_add(major_radius=5.4, minor_radius=1.55, major_segments=220, minor_segments=72)
    tor = bpy.context.active_object
    for vtx in tor.data.vertices:
        co = vtx.co; a = math.atan2(co.y, co.x)
        n1 = noise.noise(co * 0.22 + Vector((3, 1, 2)))
        rad = Vector((co.x, co.y, 0)).normalized()
        co += rad * n1 * 0.9
        co.z += 1.3 * math.sin(a * 2 + 0.7) + 0.5 * noise.noise(co * 0.35)
    for f in tor.data.polygons: f.use_smooth = True
    tor.data.materials.append(mat('glass_warm'))
    rng = random.Random(41); vals = year_values(365)
    for i, th, p, t in ring_points(365, 5.4):
        if i % 2: continue
        a = th; v = vals[i]
        rad = Vector((math.cos(a), math.sin(a), 0))
        q = p + rad * noise.noise(p * 0.22 + Vector((3, 1, 2))) * 0.9
        q.z += 1.3 * math.sin(a * 2 + 0.7)
        q += Vector((rng.gauss(0, .38), rng.gauss(0, .38), rng.gauss(0, .38)))
        m = 'ultra' if v > .72 else ('pearl' if rng.random() < .35 else 'chrome')
        token(q, t, 0.16 + 0.32 * v, 0.04, m, rot=rand_rot(rng) if rng.random() < .5 else None, xhint=p)
    camera((0, -15.5, 7.2), (0, 0, -0.5), 40)
    render('final_memory')

def s_swatches():
    """Style guide: the token in every material of the system."""
    setup(2400, 560, 160, glass=True); world_hdri('studio.exr', 0.5, 1.0); rig(1.0, 0.8, 0.8)
    for k, m in enumerate(['chrome', 'graphite', 'ultra', 'pearl', 'clay', 'glass_warm']):
        token(((k - 2.5) * 2.75, 0, 0), (0.0, -0.8, 1), 1.15, 0.38, m)
    camera((0, -21, 6.0), (0, 0, 0), 50)
    render('token_materials')

SCENES = dict(hero=s_hero, ring365=s_ring365, history=s_history, data=s_data, lab=s_lab, story=s_story,
              social=s_social, algo=s_algo, final=s_final, swatches=s_swatches)
reset()
SCENES[SCENE]()
