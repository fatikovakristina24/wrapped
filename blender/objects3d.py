# WRAPPED — music objects. Chrome + ultramarine.
# usage: Blender -b --factory-startup --python objects3d.py -- <scene> [preview]
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, Euler

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCENE = ARGS[0] if ARGS else 'vinyl'
PREVIEW = 'preview' in ARGS
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'renders', 'objects')
os.makedirs(OUT, exist_ok=True)
HDRI = '/Applications/Blender.app/Contents/Resources/5.0/datafiles/studiolights/world/studio.exr'

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)
ULTRA, ULTRA_L, WHITE = '#1F2BFF', '#A9B2FF', '#F3F3F0'

# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup(w, h, samples=128, transparent=True, glass=False, env_strength=0.9, cam_bg=None):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'
    p = bpy.context.preferences.addons['cycles'].preferences
    p.compute_device_type = 'METAL'; p.get_devices()
    for d in p.devices: d.use = d.type == 'METAL'
    sc.cycles.device = 'GPU'; sc.cycles.samples = 32 if PREVIEW else samples; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 12; sc.cycles.transmission_bounces = 12
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 40 if PREVIEW else 100
    sc.render.film_transparent = transparent; sc.cycles.film_transparent_glass = glass
    sc.view_settings.view_transform = 'Standard'  # exact brand ultramarine
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.world = bpy.data.worlds.new('W')
    nt = sc.world.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = env_strength
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    if cam_bg:
        cb = nt.nodes.new('ShaderNodeBackground'); cb.inputs['Color'].default_value = lin(cam_bg)
        lp = nt.nodes.new('ShaderNodeLightPath'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac']); nt.links.new(bg.outputs['Background'], mx.inputs[1]); nt.links.new(cb.outputs['Background'], mx.inputs[2])
        nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    else:
        nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return sc

def look_at(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()

def camera(loc, target, lens=50, fstop=None):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.clip_end = 500
    ob = bpy.data.objects.new('cam', cd); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc; look_at(ob, target); bpy.context.scene.camera = ob
    if fstop: cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop; cd.dof.focus_distance = (Vector(target) - Vector(loc)).length
    return ob

def area(loc, target, energy, color='#FFFFFF', size=6, size_y=None):
    ld = bpy.data.lights.new('L', 'AREA'); ld.energy = energy; ld.color = lin(color)[:3]
    ld.shape = 'RECTANGLE'; ld.size = size; ld.size_y = size_y or size
    ob = bpy.data.objects.new('L', ld); bpy.context.scene.collection.objects.link(ob); ob.location = loc; look_at(ob, target)
    ob.visible_camera = False
    ob.visible_transmission = False   # no light panels seen through glass / smoked plastic
    return ob

def rig(k=0.55, cold=False):
    area((7, -9, 10), (0, 0, 0), 2200 * k, '#FFFFFF', 9)
    area((-11, -2, 4), (0, 0, 0), 900 * k, '#FFFFFF', 3, 14)
    area((0, 2, 15), (0, 0, 0), 1600 * k, '#FFFFFF', 16)
    area((-8, 9, 2), (0, 0, 0), 1700 * k, '#C9CCD1' if cold else ULTRA, 8)
    area((10, 7, -3), (0, 0, 0), 1100 * k, '#C9CCD1' if cold else ULTRA_L, 8)

# ------------------------------------------------------------------ materials
MATS = {}
def principled(name, **kw):
    m = bpy.data.materials.new(name); b = m.node_tree.nodes['Principled BSDF']
    for k, v in kw.items(): b.inputs[k.replace('_', ' ')].default_value = v
    return m

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
def textured(name, image, base_color, rough, size, emit=0.0):
    """Printed material: image (object-space planar) tinted by base_color."""
    m = bpy.data.materials.new(name); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / size[0], 1 / size[1], 1); mp.inputs['Location'].default_value = (0.5, 0.5, 0)
    im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(TEX, image)); im.extension = 'CLIP'
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
    mix.inputs[6].default_value = base_color
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], im.inputs['Vector'])
    nt.links.new(im.outputs['Color'], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = base_color; b.inputs['Emission Strength'].default_value = emit
    return m

def mat(name):
    if name in MATS: return MATS[name]
    if name.startswith('lbl_'):            # printed record label in the colour of the base material
        base = name[4:]; col = {'ultra': lin(ULTRA), 'ultra_matte': lin(ULTRA), 'white': lin(WHITE), 'black_matte': lin('#2a2a30'), 'clay': lin('#D3D6D8'), 'clay_dark': lin('#8E959A')}.get(base, lin(WHITE))
        MATS[name] = textured(name, 'label.png', col, 0.45, (0.67, 0.67)); return MATS[name]
    if name == 'sticker': MATS[name] = textured(name, 'sticker.png', (1, 1, 1, 1), 0.4, (1.7, 0.22)); return MATS[name]
    if name == 'sticker_low': MATS[name] = textured(name, 'sticker_low.png', (1, 1, 1, 1), 0.4, (1.7, 0.12)); return MATS[name]
    if name == 'chrome': m = principled(name, Base_Color=lin('#E9EAEC'), Metallic=1, Roughness=0.06)
    elif name == 'chrome_brushed': m = principled(name, Base_Color=lin('#D6D8DA'), Metallic=1, Roughness=0.25, Anisotropic=0.8)
    elif name == 'ultra': m = principled(name, Base_Color=lin(ULTRA), Roughness=0.25, Coat_Weight=1, Coat_Roughness=0.03)
    elif name == 'ultra_matte': m = principled(name, Base_Color=lin(ULTRA), Roughness=0.6)
    elif name == 'white': m = principled(name, Base_Color=lin(WHITE), Roughness=0.3, Coat_Weight=0.6)
    elif name == 'black_gloss': m = principled(name, Base_Color=lin('#0B0B0C'), Roughness=0.12, Coat_Weight=1, Coat_Roughness=0.02)
    elif name == 'black_matte': m = principled(name, Base_Color=lin('#121214'), Roughness=0.7)
    elif name == 'rubber': m = principled(name, Base_Color=lin('#18181A'), Roughness=0.55, Sheen_Weight=0.3)
    elif name == 'clay': m = principled(name, Base_Color=lin('#D3D6D8'), Roughness=0.6)
    elif name == 'clay_dark': m = principled(name, Base_Color=lin('#8E959A'), Roughness=0.55)
    elif name == 'smoke': m = principled(name, Base_Color=lin('#C9CCD1'), Transmission_Weight=1, Roughness=0.05, IOR=1.49)
    elif name == 'smoke_ultra': m = principled(name, Base_Color=lin('#8C95FF'), Transmission_Weight=1, Roughness=0.08, IOR=1.49)
    elif name == 'glass': m = principled(name, Base_Color=lin('#EEF0FF'), Transmission_Weight=1, Roughness=0.03, IOR=1.45, Thin_Film_Thickness=380, Thin_Film_IOR=1.35)
    elif name == 'tape': m = principled(name, Base_Color=lin('#2A2320'), Metallic=0.3, Roughness=0.3)
    elif name == 'tape_ultra': m = principled(name, Base_Color=lin('#1A1E6E'), Metallic=0.4, Roughness=0.25)
    elif name == 'vinyl':
        m = principled(name, Base_Color=lin('#020203'), Roughness=0.1, Specular_IOR_Level=0.5)
        nt = m.node_tree; b = nt.nodes['Principled BSDF']
        # grooves: concentric rings -> bump + anisotropic sheen
        tc = nt.nodes.new('ShaderNodeTexCoord'); wave = nt.nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'RINGS'; wave.inputs['Scale'].default_value = 90; wave.inputs['Distortion'].default_value = 0.3
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.002
        nt.links.new(tc.outputs['Object'], wave.inputs['Vector']); nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
        b.inputs['Anisotropic'].default_value = 0.9
    elif name == 'vinyl_matte': m = principled(name, Base_Color=lin('#9AA0A6'), Roughness=0.65)
    elif name == 'speaker_cone':
        m = principled(name, Base_Color=lin('#111113'), Roughness=0.45, Sheen_Weight=0.4)
    elif name == 'grille':
        m = principled(name, Base_Color=lin('#CFD2D6'), Metallic=1, Roughness=0.2)
    else: raise KeyError(name)
    MATS[name] = m; return m

def assign(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(mat(m) if isinstance(m, str) else m); return ob

def smooth(ob, angle=35):
    for p in ob.data.polygons: p.use_smooth = True
    try:
        mod = ob.modifiers.new('sm', 'NODES')
        bpy.ops.object.select_all(action='DESELECT')
    except Exception: pass
    return ob

def link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    e = bpy.data.objects.new(name, None); link(e); e.location = loc; e.rotation_euler = rot; e.scale = (scale,) * 3; return e

def lathe(name, profile, segs=96, m='chrome', parent=None):
    """profile: list of (r, z) points -> surface of revolution around Z."""
    bm = bmesh.new(); rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs; ring = []
        for r, z in profile: ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(len(profile) - 1):
            bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob, parent); assign(ob, m)
    for p in me.polygons: p.use_smooth = True
    return ob

def cyl(name, r, h, m, loc=(0, 0, 0), parent=None, segs=64, bevel=0.0, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r2 if r2 is not None else r, depth=h)
    if bevel:
        rim = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=3, profile=0.5, affect='EDGES')
    for f in bm.faces: f.smooth = abs(f.normal.z) < 0.999
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob, parent); ob.location = loc; assign(ob, m); return ob

def box(name, size, m, loc=(0, 0, 0), parent=None, bevel=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=4, profile=0.5, affect='EDGES')
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob, parent); ob.location = loc; assign(ob, m)
    if bevel:
        for p in me.polygons: p.use_smooth = p.area < 0.05 * size[0] * size[1]
    return ob

def torus(name, R, r, m, loc=(0, 0, 0), parent=None):
    bm = bmesh.new(); seg, mseg = 96, 24; verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; row = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            row.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        verts.append(row)
    for i in range(seg):
        for j in range(mseg):
            bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % mseg], verts[i][(j + 1) % mseg]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob, parent); ob.location = loc; assign(ob, m)
    for p in me.polygons: p.use_smooth = True
    return ob

def tube(name, pts, radius, m, parent=None, closed=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 6
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu); link(ob, parent); cu.materials.append(mat(m)); return ob

def ribbon(name, pts, width, m, up=(0, 0, 1), parent=None, thick=0.004):
    """flat tape along a path (cassette tape)."""
    bm = bmesh.new(); prev = None
    for i, p in enumerate(pts):
        p = Vector(p); t = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        u = Vector(up); side = t.cross(u).normalized() if t.cross(u).length > 1e-4 else Vector((1, 0, 0))
        nrm = side.cross(t).normalized()
        a = bm.verts.new(p + nrm * width / 2); b = bm.verts.new(p - nrm * width / 2)
        if prev: bm.faces.new((prev[0], prev[1], b, a))
        prev = (a, b)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); link(ob, parent); assign(ob, m)
    s = ob.modifiers.new('s', 'SOLIDIFY'); s.thickness = thick
    for p in me.polygons: p.use_smooth = True
    return ob

def export_glb(name, root):
    """Same model for the browser (three.js): parts stay separate named nodes for animation."""
    d = os.path.join(os.path.dirname(OUT), '..', 'web3d'); os.makedirs(d, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root); bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=os.path.join(d, name + '.glb'), use_selection=True, export_apply=True, export_format='GLB')

def render(name):
    sc = bpy.context.scene; sc.render.filepath = os.path.join(OUT, ('_prev_' if PREVIEW else '') + name); bpy.ops.render.render(write_still=True)

# ------------------------------------------------------------------ OBJECTS
def vinyl(parent=None, label='ultra', m='vinyl', loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='vinyl'):
    root = empty(name, loc, rot, scale); root.parent = parent
    # record body: slightly raised rim and label area, like a real 12"
    prof = [(0.0, 0.009), (0.36, 0.009), (0.365, 0.012), (0.98, 0.012), (1.0, 0.009), (1.0, -0.009), (0.98, -0.012), (0.365, -0.012), (0.36, -0.009), (0.0, -0.009)]
    body = lathe(name + '_body', prof, 160, m, root)
    for pl in body.data.polygons: pl.use_smooth = abs(pl.normal.z) < 0.9   # flat faces stay flat, only the rim is soft
    lab_m = label if isinstance(label, str) else 'ultra'
    cyl(name + '_label', 0.335, 0.026, 'lbl_' + lab_m, (0, 0, 0), root, 96)
    cyl(name + '_hole', 0.025, 0.03, 'chrome', (0, 0, 0), root, 32)
    return root

def cassette(parent=None, shell='smoke', tape='tape', loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='cassette', with_tape=True):
    root = empty(name, loc, rot, scale); root.parent = parent
    W, H, D = 2.0, 1.26, 0.24
    box(name + '_shell', (W, H, D), shell, (0, 0, 0), root, bevel=0.03)
    box(name + '_label', (1.7, 0.22, 0.006), 'sticker', (0, 0.47, D / 2 + 0.004), root, bevel=0.002)
    box(name + '_label_band', (1.7, 0.07, 0.007), 'ultra', (0, 0.38, D / 2 + 0.006), root, bevel=0.002)
    box(name + '_label_low', (1.7, 0.12, 0.006), 'sticker_low', (0, -0.3, D / 2 + 0.004), root, bevel=0.002)
    for sx in (-0.5, 0.5):
        reel = cyl(name + '_reel', 0.16, 0.12, 'white', (sx, 0.12, 0), root, 48)
        cyl(name + '_hub', 0.07, 0.14, 'chrome', (sx, 0.12, 0), root, 6)
        if with_tape:
            cyl(name + '_pack', 0.3, 0.1, tape, (sx, 0.12, 0), root, 64)
    for sx, sy in ((-0.92, 0.55), (0.92, 0.55), (-0.92, -0.55), (0.92, -0.55), (0, -0.5)):
        cyl(name + '_screw', 0.04, D + 0.01, 'chrome', (sx, sy, 0), root, 16)
    box(name + '_head', (1.2, 0.2, D * 0.9), shell, (0, -0.58, 0), root, bevel=0.02)
    return root

def speaker_driver(parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='driver', explode=0.0):
    root = empty(name, loc, rot, scale); root.parent = parent
    e = explode
    # cone (paper), surround (rubber), dust cap (chrome dome), basket ring, magnet
    lathe(name + '_cone', [(0.18, -0.38), (0.5, -0.22), (0.86, -0.02)], 128, 'speaker_cone', root).location.z = 0 + e * 0.0
    torus(name + '_surround', 0.92, 0.07, 'rubber', (0, 0, 0.0 + e * 0.6), root)
    dome = lathe(name + '_cap', [(0.0, -0.12), (0.12, -0.16), (0.2, -0.24), (0.22, -0.3)][::-1], 96, 'ultra', root); dome.location.z = 0.04 + e * 1.4
    torus(name + '_basket', 1.02, 0.035, 'chrome', (0, 0, 0.0 - e * 0.5), root)
    cyl(name + '_ring', 1.04, 0.05, 'chrome_brushed', (0, 0, -0.03 - e * 0.5), root, 128)
    cyl(name + '_magnet', 0.42, 0.26, 'chrome_brushed', (0, 0, -0.62 - e * 1.6), root, 96, bevel=0.02)
    cyl(name + '_plate', 0.46, 0.05, 'black_gloss', (0, 0, -0.47 - e * 1.1), root, 96)
    return root

def speaker_box(parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='box', finish='black_gloss'):
    root = empty(name, loc, rot, scale); root.parent = parent
    box(name + '_cab', (1.3, 2.0, 1.1), finish, (0, 0, 0), root, bevel=0.05)
    speaker_driver(root, (0, -0.4, 0.56), (0, 0, 0), 0.52, name + '_woof')
    speaker_driver(root, (0, 0.62, 0.56), (0, 0, 0), 0.22, name + '_tw')
    return root

def microphone(parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='mic'):
    root = empty(name, loc, rot, scale); root.parent = parent
    # grille: sphere-ish capsule with wireframe mesh
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.5, location=(0, 0, 0))
    g = bpy.context.active_object; g.name = name + '_grille'; g.parent = root; g.scale = (1, 1, 1.25)
    w = g.modifiers.new('w', 'WIREFRAME'); w.thickness = 0.012; assign(g, 'grille')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=0.46, location=(0, 0, 0))
    inner = bpy.context.active_object; inner.parent = root; inner.scale = (1, 1, 1.22); assign(inner, 'black_matte')
    for p in inner.data.polygons: p.use_smooth = True
    torus(name + '_band', 0.5, 0.03, 'chrome', (0, 0, -0.05), root)
    lathe(name + '_body', [(0.36, -0.55), (0.3, -1.4), (0.24, -2.6), (0.0, -2.62)], 96, 'chrome', root)
    cyl(name + '_switch', 0.08, 0.04, 'ultra', (0, -0.33, -1.1), root, 32).rotation_euler = (math.pi / 2, 0, 0)
    return root

def headphones(parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name='hp', band='chrome', cup='black_gloss', pad='rubber'):
    root = empty(name, loc, rot, scale); root.parent = parent
    # headband arc
    pts = [(1.25 * math.cos(a), 0, 1.45 * math.sin(a) + 0.1) for a in [math.pi * i / 60 for i in range(61)]]
    tube(name + '_band', pts, 0.07, band, root)
    pts2 = [(1.18 * math.cos(a), 0, 1.36 * math.sin(a) + 0.1) for a in [math.pi * (0.12 + 0.76 * i / 50) for i in range(51)]]
    tube(name + '_cushion', pts2, 0.085, 'ultra', root)
    for s in (-1, 1):
        cup_root = empty(name + '_side', (s * 1.3, 0, -0.25), (0, s * math.pi / 2, 0)); cup_root.parent = root
        cyl(name + '_cup', 0.55, 0.32, cup, (0, 0, s * 0.0), cup_root, 96, bevel=0.08)
        torus(name + '_pad', 0.42, 0.13, pad, (0, 0, -0.2 * s if s > 0 else 0.2), cup_root)
        cyl(name + '_cap', 0.3, 0.34, 'chrome', (0, 0, 0.02 * s), cup_root, 96, bevel=0.03)
        # yoke
        tube(name + '_yoke', [(s * 1.25, 0, 0.1), (s * 1.3, 0, 0.35)], 0.05, 'chrome', root)
    return root

# ================================================================= PREVIEW SCENES
def p_vinyl():
    setup(1600, 1000, env_strength=0.12); rig(0.5)
    hero = vinyl(None, loc=(0, 0, 0), rot=(math.radians(62), 0, math.radians(18)), scale=3)
    rng = random.Random(3)
    for i in range(14):
        vinyl(None, loc=(rng.uniform(-7, 7), rng.uniform(0, 8), rng.uniform(-3, 4)), rot=(rng.uniform(0, 6), rng.uniform(0, 6), 0), scale=rng.uniform(0.5, 1.1), name='v%d' % i)
    camera((0, -11, 3.5), (0, 0, 0), 45)
    render('vinyl')
    if not PREVIEW: export_glb('vinyl', hero)

def p_cassette():
    setup(1600, 1000); rig(1.0)
    r = cassette(None, rot=(math.radians(70), 0, math.radians(-15)), scale=2.6)
    camera((0, -9, 2.5), (0, 0, 0), 50)
    render('cassette')
    if not PREVIEW: export_glb('cassette', r)

def p_speaker():
    setup(1600, 1000); rig(1.0)
    speaker_driver(None, loc=(-2.4, 0, 0), rot=(0, math.radians(70), math.radians(-25)), scale=1.6, explode=1.0, name='expl')
    speaker_box(None, loc=(3.0, 0.5, -0.2), rot=(math.radians(90), 0, math.radians(-20)), scale=1.4)
    camera((0, -12, 3.0), (0, 0, 0), 45)
    render('speaker')

def p_mic():
    setup(1000, 1400); rig(1.0)
    microphone(None, rot=(math.radians(-20), math.radians(10), 0), scale=1.6)
    camera((0, -9, 0.5), (0, 0, -1.2), 50)
    render('mic')

def p_headphones():
    setup(1600, 1000); rig(1.0)
    headphones(None, rot=(math.radians(10), 0, math.radians(30)), scale=1.6)
    camera((0, -12, 2.6), (0, 0, 0.9), 50)
    render('headphones')


# ================================================================= CHAPTER SCENES
VCACHE = {}
def vinyl_fast(M, label='ultra_matte', body='vinyl'):
    """cheap instanced record: shares meshes, one matrix."""
    if 'proto' not in VCACHE:
        tmp = vinyl(None, name='proto')
        VCACHE['proto'] = {c.name.split('_')[-1]: c.data for c in tmp.children}
        for c in list(tmp.children): bpy.data.objects.remove(c)
        bpy.data.objects.remove(tmp)
    out = []
    for part, me in VCACHE['proto'].items():
        key = (part, body, label)
        if key not in VCACHE:
            m2 = me.copy(); m2.materials.clear()
            m2.materials.append(mat({'body': body, 'label': 'lbl_' + label, 'hole': 'chrome'}[part])); VCACHE[key] = m2
        ob = bpy.data.objects.new('rec_' + part, VCACHE[key]); link(ob); ob.matrix_world = M; out.append(ob)
    return out

def basis(zdir, xhint=None):
    z = Vector(zdir).normalized()
    x = Vector(xhint) if xhint is not None else (Vector((0, 0, 1)) if abs(z.z) < 0.9 else Vector((1, 0, 0)))
    x = x - z * x.dot(z)
    if x.length < 1e-6: x = Vector((1, 0, 0))
    x.normalize(); y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()

def year_values(n=365, seed=7):
    from mathutils import noise
    rng = random.Random(seed); v = []
    for d in range(n):
        t = d / n
        b = 0.42 + 0.18 * math.sin(t * 6.283 * 2 + 0.6) + 0.12 * math.sin(t * 6.283 * 7.3) + 0.22 * noise.noise(Vector((t * 9, 0.3, 0.7)))
        if d % 7 in (5, 6): b += 0.12
        if d > 330: b += 0.2 * (d - 330) / 35
        if rng.random() < 0.05: b += rng.uniform(0.25, 0.5)
        v.append(max(0.06, b + rng.uniform(-0.06, 0.06)))
    mx = max(v); return [x / mx for x in v]

def M_of(loc, R, s):
    return Matrix.Translation(Vector(loc)) @ R @ Matrix.Diagonal((s, s, s, 1))

def c_hero():
    """00 — one huge record, cinematic crop + a year of records in flight."""
    setup(2880, 1800, 110, env_strength=0.15); rig(0.55)
    rng = random.Random(3); objs = []
    big = vinyl_fast(M_of((0.6, 1.0, -0.4), Euler((math.radians(64), math.radians(-8), math.radians(22))).to_matrix().to_4x4(), 5.4))
    for i in range(46):
        loc = Vector((rng.uniform(-11, 11), rng.uniform(-5, 14), rng.uniform(-5, 6)))
        s = rng.uniform(0.35, 1.0)
        lab = 'ultra_matte' if rng.random() < .75 else 'white'
        objs += vinyl_fast(M_of(loc, Euler((rng.uniform(0, 6.3), rng.uniform(0, 6.3), 0)).to_matrix().to_4x4(), s), lab)
    camera((0, -15, 3.2), (0.4, 0, -0.2), 40, fstop=2.8)
    render('hero_vinyl')
    for o in big + objs: o.hide_render = not (o.matrix_world.translation.y < -1.5)
    render('hero_vinyl_front')

def c_ring365():
    """01 — 365 records stacked into one loop; record size = minutes that day."""
    setup(2880, 2160, 110, env_strength=0.15); rig(0.6)
    vals = year_values(); top = max(range(365), key=lambda i: vals[i]); objs = []
    R = 6.0
    for i in range(365):
        th = math.radians(90) + 2 * math.pi * i / 365
        p = Vector((R * math.cos(th), R * math.sin(th), 0)); t = Vector((-math.sin(th), math.cos(th), 0))
        v = vals[i]; s = 0.4 + 1.15 * v
        lab = 'white' if i == top else ('ultra_matte' if v > 0.55 else 'black_matte')
        objs += vinyl_fast(M_of(p, basis(t, p), s), lab)
    camera((0.0, -13.0, 9.5), (0.0, -0.6, -0.4), 40)
    render('ring365_vinyl')
    for o in objs: o.hide_render = not (o.matrix_world.translation.y < -2.2)
    render('ring365_vinyl_front')

def c_history():
    for era in ('2015', '2016', 'now'):
        reset(); MATS.clear(); VCACHE.clear()
        setup(1800, 1800, 110, glass=True, env_strength=0.5); rig(0.6)
        if era == '2015':
            r = cassette(None, rot=(math.radians(68), math.radians(-6), math.radians(-18)), scale=2.4)
            camera((0, -9.5, 2.5), (0, 0, 0), 50)
        elif era == '2016':
            for k in range(9):
                a = math.radians(k * 9 - 30)
                vinyl_fast(M_of((0, 0, -1.2 + k * 0.28), Euler((0, 0, a)).to_matrix().to_4x4() @ Matrix.Translation((0.12 * k, 0, 0)), 2.6), 'white' if k == 8 else 'ultra_matte')
            camera((0, -10.5, 6.5), (0, 0, 0), 45)
        else:
            r = headphones(None, rot=(math.radians(10), 0, math.radians(30)), scale=2.0)
            camera((0, -12, 2.6), (0, 0, 0.9), 45)
        render('history_' + era)

def c_data():
    from mathutils import noise
    # MINUTES — a tall leaning tower of records, slowly twisting
    reset(); MATS.clear(); VCACHE.clear()
    setup(1200, 2400, 110, env_strength=0.2); rig(0.6)
    for k in range(70):
        a = k * 0.21; off = Vector((0.18 * math.sin(k * 0.17), 0.18 * math.cos(k * 0.13), 0))
        vinyl_fast(M_of(Vector((0, 0, -7 + k * 0.2)) + off, Euler((0, 0, a)).to_matrix().to_4x4(), 1.6), 'ultra_matte' if k % 10 == 9 else 'black_matte')
    camera((0, -26, 4.5), (0, 0, 0.0), 55)
    render('data_minutes')
    # TRACKS — grid of cassette stacks
    reset(); MATS.clear(); VCACHE.clear()
    setup(1800, 1500, 96, glass=True, env_strength=0.5); rig(0.6)
    for gx in range(4):
        for gy in range(3):
            h = int(1 + 6 * (0.5 + 0.5 * noise.noise(Vector((gx * .5, gy * .5, .3)))))
            for k in range(h):
                cassette(None, loc=(gx * 2.4 - 3.6, gy * 1.6 - 1.6, k * 0.26), rot=(0, 0, 0), scale=1.0, name='c%d%d%d' % (gx, gy, k), with_tape=k == h - 1)
    camera((9.5, -11, 9.5), (0, 0, 0.6), 50)
    render('data_tracks')
    # ARTISTS — a planet of records
    reset(); MATS.clear(); VCACHE.clear()
    setup(1600, 1600, 110, env_strength=0.2); rig(0.6)
    rng = random.Random(8); n = 140; ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - 2 * (i + .5) / n; rr = math.sqrt(1 - y * y); th = ga * i
        d = Vector((math.cos(th) * rr, y, math.sin(th) * rr)); big = rng.random() < 0.05
        vinyl_fast(M_of(d * 3.1, basis(d), 0.9 if big else 0.5), 'white' if big else ('ultra_matte' if rng.random() < .5 else 'black_matte'))
    camera((0, -12, 2.5), (0, 0, 0), 50)
    render('data_artists')
    # GENRES — ring of record stacks, height = share
    reset(); MATS.clear(); VCACHE.clear()
    setup(1800, 1300, 110, env_strength=0.2); rig(0.6)
    rng = random.Random(12); n = 18; sh = sorted([rng.paretovariate(1.4) for _ in range(n)], reverse=True); mx = sh[0]
    for i in range(n):
        th = 2 * math.pi * i / n; p = Vector((4.2 * math.cos(th), 4.2 * math.sin(th), 0)); h = max(1, int(14 * (sh[i] / mx) ** 0.7))
        for k in range(h):
            vinyl_fast(M_of(p + Vector((0, 0, k * 0.07)), Euler((0, 0, rng.uniform(0, 6))).to_matrix().to_4x4(), 0.75), 'ultra_matte' if i < 3 else ('white' if i < 5 else 'black_matte'))
    camera((0, -11, 7.5), (0, 0, 0.3), 48)
    render('data_genres')

def c_lab():
    setup(2000, 2400, 128, env_strength=0.5); rig(0.65)
    d = Vector((0.18, -0.62, 0.76)); rq = d.to_track_quat('Z', 'Y').to_euler()
    r = speaker_driver(None, loc=(0, 0, 0.6), rot=rq, scale=2.2, explode=1.5, name='lab')
    camera((0, -19, 1.0), (0, 0, -0.3), 50)
    render('lab_speaker')
    if not PREVIEW: export_glb('speaker_driver', r)

def c_story():
    setup(3600, 1300, 110, glass=True, env_strength=0.5); rig(0.6)
    cassette(None, loc=(-9.2, 0.5, 0.3), rot=(math.radians(72), 0, math.radians(-22)), scale=3.2, name='cas')
    bm = bmesh.new(); prev = None
    for i in range(700):
        t = i / 699
        c = Vector((-8.6 + 26 * t, 2.6 * math.sin(t * math.pi * 2.2) + 2.0 * t, 1.9 * math.sin(t * math.pi * 3.0 + .5) - 0.4))
        tw = t * math.pi * 3.0                                  # the tape twists as the story unfolds
        side = Vector((0, -math.sin(tw), math.cos(tw))) * 0.55
        a = bm.verts.new(c + side); b = bm.verts.new(c - side)
        if prev: bm.faces.new((prev[0], prev[1], b, a))
        prev = (a, b)
    me = bpy.data.meshes.new('tape'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('tape', me); link(ob); assign(ob, 'tape_ultra'); ob.modifiers.new('s', 'SOLIDIFY').thickness = 0.015
    for pl in me.polygons: pl.use_smooth = True
    camera((0, -21, 5.5), (1.5, 0, -0.3), 40, fstop=6.0)
    render('story_tape')

def c_social():
    setup(2880, 2200, 110, env_strength=0.5); rig(0.6)
    mic = microphone(None, loc=(0, 0, 0.4), rot=(math.radians(-24), math.radians(14), 0), scale=1.5)
    rng = random.Random(21)
    spots = [(-8.5, 7, 3.2), (8.5, 6, 3.5), (-6.5, 2, -3.5), (7.0, 1, -3.8), (-12, 14, -1), (13, 15, 0.5), (1, 12, 6.0), (-3.5, 4, 5.0), (4.0, 4, -6.0), (-10, 9, 6.5), (11, 8, -6.5)]
    for k, (x, y, z) in enumerate(spots):
        speaker_box(None, loc=(x, y, z), rot=(math.radians(90 + rng.uniform(-25, 25)), rng.uniform(-0.4, 0.4), rng.uniform(-0.8, 0.8)), scale=rng.uniform(0.9, 1.6), name='box%d' % k, finish='black_gloss' if k % 3 else 'white')
    for i in range(26):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1) * 0.6 + 0.5, rng.gauss(0, 1))).normalized(); r = 4 + rng.expovariate(0.15)
        vinyl_fast(M_of(d * r, Euler((rng.uniform(0, 6), rng.uniform(0, 6), 0)).to_matrix().to_4x4(), rng.uniform(0.4, 0.9)), 'ultra_matte' if rng.random() < .6 else 'white')
    camera((0, -17, 1.2), (0, 0, 0), 38, fstop=3.2)
    render('social_mic')
    if not PREVIEW: export_glb('microphone', mic)

def c_algo():
    setup(2880, 2000, 110, glass=True, env_strength=0.6); rig(0.6, cold=True)
    cassette(None, loc=(-1.0, 0, 1.4), rot=(math.radians(68), math.radians(-10), math.radians(-14)), scale=2.6, shell='clay', tape='clay_dark', name='grey')
    rng = random.Random(31); pts = []
    for i in range(900):
        t = i / 899
        a = t * math.pi * 9; r = 0.6 + 3.2 * t
        pts.append((-0.6 + r * math.cos(a) * 1.3 + rng.gauss(0, .05), -0.4 + r * math.sin(a * 0.7) * 0.6, -0.2 - 4.2 * t + 0.9 * math.sin(a * 1.3)))
    ribbon('tangle', pts, 0.34, 'clay_dark', up=(0, 0, 1), thick=0.008)
    for i in range(5):
        seg = [(x + rng.uniform(-3, 3), y + rng.uniform(-1, 1), z - rng.uniform(0, 1.5)) for (x, y, z) in pts[i * 60:i * 60 + 40]]
    camera((-1.0, -14.5, 3.5), (0.4, 0, -1.2), 42)
    render('algo_cassette')

def c_final():
    setup(2400, 2000, 200, transparent=False, env_strength=0.06, cam_bg='#0A0A0B')
    area((0, 9, 3), (0, 0, 0), 900, ULTRA_L, 9); area((-9, 2, 2), (0, 0, 0), 250, '#FFFFFF', 2, 12)
    area((8, -2, -4), (0, 0, 0), 700, ULTRA, 5); area((-6, 6, 7), (0, 0, 0), 500, '#FFFFFF', 3)
    rec = vinyl(None, m='glass', label='ultra', rot=(math.radians(64), math.radians(-8), math.radians(22)), scale=3.3, name='memory')
    glow = bpy.data.materials.new('glow'); gb = glow.node_tree.nodes['Principled BSDF']
    gb.inputs['Emission Color'].default_value = lin(ULTRA_L); gb.inputs['Emission Strength'].default_value = 1.3; gb.inputs['Base Color'].default_value = lin(ULTRA_L)
    spark = bpy.data.materials.new('spark'); sb = spark.node_tree.nodes['Principled BSDF']
    sb.inputs['Emission Color'].default_value = (1, 1, 1, 1); sb.inputs['Emission Strength'].default_value = 25
    MATS['glow'] = glow; MATS['spark'] = spark
    rr = random.Random(8)
    for k in range(5):
        t = torus('thread%d' % k, 1.0, 0.0022, 'glow')
        t.scale = (4.2 + k * 0.55, 1.9 + k * 0.35, 1); t.rotation_euler = (math.radians(70 + k * 12), math.radians(k * 25 - 40), math.radians(k * 63))
        a = rr.uniform(0, 6.28); sp = Matrix.Rotation(t.rotation_euler.z, 4, 'Z') @ Matrix.Rotation(t.rotation_euler.y, 4, 'Y') @ Matrix.Rotation(t.rotation_euler.x, 4, 'X') @ Vector((math.cos(a) * t.scale.x, math.sin(a) * t.scale.y, 0, 1))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=sp.xyz); assign(bpy.context.active_object, 'spark')
    for i in range(260):
        a = rr.uniform(0, 6.28); r = rr.uniform(2.2, 7.5)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rr.uniform(0.012, 0.04), subdivisions=1, location=(math.cos(a) * r, math.sin(a) * r * 0.6 + rr.uniform(-1, 1), rr.uniform(-2.5, 2.5)))
        assign(bpy.context.active_object, 'spark' if rr.random() < .4 else 'glow')
    rng = random.Random(4)
    for i in range(9):
        loc = Vector((rng.uniform(-8, 8), rng.uniform(1, 9), rng.uniform(-4, 4)))
        vinyl(None, m='glass', label=rng.choice(['ultra', 'white']), loc=loc, rot=(rng.uniform(0, 6), rng.uniform(0, 6), 0), scale=rng.uniform(0.5, 1.0), name='g%d' % i)
    camera((0, -15.5, 4.0), (0, 0, -0.3), 40)
    render('final_glass_vinyl')
    if not PREVIEW: export_glb('vinyl_glass', rec)

def c_swatches():
    setup(2400, 560, 128, glass=True, env_strength=0.4); rig(0.6)
    for k, (body, lab) in enumerate([('vinyl', 'ultra_matte'), ('chrome', 'white'), ('ultra', 'white'), ('smoke', 'ultra'), ('clay', 'clay_dark'), ('glass', 'ultra')]):
        vinyl(None, m=body, label=lab, loc=((k - 2.5) * 2.75, 0, 0), rot=(math.radians(55), 0, 0), scale=1.2, name='sw%d' % k)
    camera((0, -21, 6.0), (0, 0, 0), 50)
    render('token_materials')

def c_exports():
    """GLBs of every object for the HTML build."""
    for name, fn in [('headphones', lambda: headphones(None)), ('speaker_box', lambda: speaker_box(None)), ('microphone', lambda: microphone(None)), ('cassette', lambda: cassette(None)), ('vinyl', lambda: vinyl(None))]:
        reset(); MATS.clear(); r = fn(); export_glb(name, r)

def c_minutes():
    setup(1200, 2400, 110, env_strength=0.7); rig(1.0)
    for k in range(70):
        a = k * 0.21; off = Vector((0.18 * math.sin(k * 0.17), 0.18 * math.cos(k * 0.13), 0))
        body = 'chrome' if k % 7 == 3 else ('ultra' if k % 10 == 9 else 'vinyl')
        vinyl_fast(M_of(Vector((0, 0, -7 + k * 0.2)) + off, Euler((0, 0, a)).to_matrix().to_4x4(), 1.6), 'white' if body != 'vinyl' else 'ultra_matte', body)
    camera((3, -24, 6.5), (0, 0, 0.0), 55)
    render('data_minutes')

def c_yearrec():
    """01 — the record of the year: 365 day-bars standing on a spinning record + tonearm."""
    setup(2880, 2160, 120, env_strength=0.25); rig(0.6)
    vals = year_values(); top = max(range(365), key=lambda i: vals[i])
    root = empty('yr', (0, 0.6, -1.2), (math.radians(14), 0, math.radians(-12)), 1.0)
    rec = vinyl(root, scale=4.6, name='bigrec')
    R0 = 4.6 * 0.83
    for i in range(365):
        a = math.pi / 2 - 2 * math.pi * i / 365
        v = vals[i]; h = 0.2 + v * 2.1
        m = 'pearl_bar' if i == top else ('ultra' if v > 0.55 else 'chrome')
        b = box('bar%d' % i, (0.05, 0.13, h), 'ultra' if v > 0.55 else 'chrome', (R0 * math.cos(a), R0 * math.sin(a), 0.06 + h / 2), root, bevel=0.01)
        b.rotation_euler = (0, 0, a)
    # tonearm
    base = cyl('arm_base', 0.42, 0.35, 'chrome_brushed', (5.6, 3.2, 0.2), root, 64, bevel=0.03)
    tube('arm', [(5.6, 3.2, 0.5), (4.6, 0.9, 0.55), (3.3, -1.4, 0.45)], 0.07, 'chrome', root)
    box('head', (0.5, 0.28, 0.12), 'ultra', (3.25, -1.5, 0.38), root, bevel=0.03)
    cyl('weight', 0.22, 0.4, 'black_gloss', (5.9, 3.9, 0.55), root, 48, bevel=0.03).rotation_euler = (math.radians(70), 0, math.radians(25))
    camera((0, -15.5, 8.5), (0, 0.4, -0.4), 40)
    render('year_record')

def c_hourglass():
    """03 minutes — an hourglass where tiny records fall instead of sand."""
    setup(1200, 2400, 160, glass=True, env_strength=0.5); rig(0.6)
    root = empty('hg', (0, 0, 0), (math.radians(8), 0, math.radians(-6)), 1.0)
    prof = [(0.13, 0.0), (0.35, 0.25), (0.8, 0.75), (1.05, 1.35), (1.0, 1.9), (0.7, 2.25), (0.05, 2.32)]
    full = [(r, -z) for r, z in reversed(prof)] + prof
    lathe('glass', full, 128, 'glass', root)
    for z in (2.42, -2.42):
        cyl('cap', 1.22, 0.16, 'chrome', (0, 0, z), root, 96, bevel=0.03)
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.4
        cyl('post', 0.05, 4.7, 'chrome', (1.17 * math.cos(a), 1.17 * math.sin(a), 0), root, 24)
    rng = random.Random(9)
    def disc(p, s, lab):
        vinyl_fast(Matrix.Translation(Vector(p)) @ Euler((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(0, 6))).to_matrix().to_4x4() @ Matrix.Diagonal((s, s, s, 1)), lab)
    M = root.matrix_world
    for i in range(70):   # top: what's left of the year
        z = rng.uniform(0.35, 1.5); rr = (z - 0.2) * 0.62 * math.sqrt(rng.random())
        a = rng.uniform(0, 6.28); disc(M @ Vector((rr * math.cos(a), rr * math.sin(a), z)), 0.15, 'ultra_matte' if rng.random() < .6 else 'white')
    for i in range(14):   # the stream through the neck
        z = 0.3 - i * 0.12; disc(M @ Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), z)), 0.1, 'ultra_matte')
    for i in range(110):  # bottom: minutes already listened
        z = -2.2 + rng.random() ** 1.6 * 1.0; rr = (1 - (z + 2.2) / 1.1) * 0.95 * math.sqrt(rng.random())
        a = rng.uniform(0, 6.28); disc(M @ Vector((rr * math.cos(a), rr * math.sin(a), z)), 0.15, 'ultra_matte' if rng.random() < .55 else ('white' if rng.random() < .5 else 'black_matte'))
    camera((0, -14, 1.2), (0, 0, 0), 50)
    render('hourglass')

def c_lab2():
    """04 — speaker specimen inside a vortex of records with sound rings leaving the cone."""
    setup(2000, 2400, 128, env_strength=0.5); rig(0.65)
    d = Vector((0.18, -0.62, 0.76)); rq = d.to_track_quat('Z', 'Y').to_euler()
    speaker_driver(None, loc=(0, 0, 0.3), rot=rq, scale=1.7, explode=1.5, name='lab')
    rng = random.Random(5)
    for i in range(48):
        a = rng.uniform(0, 6.28); r = 3.2 + rng.random() * 2.6
        loc = Vector((math.cos(a) * r, rng.uniform(-1.5, 2.5), math.sin(a) * r * 1.3))
        vinyl_fast(M_of(loc, Euler((rng.uniform(0, 6), rng.uniform(0, 6), 0)).to_matrix().to_4x4(), rng.uniform(0.25, 0.55)), 'ultra_matte' if rng.random() < .7 else 'white')
    for k in range(4):   # sound rings
        t = torus('ring%d' % k, 1.6 + k * 0.9, 0.025, 'ultra', (0, 0, 0))
        t.rotation_euler = rq; t.location = Vector((0, 0, 0.3)) + d * (1.9 + k * 0.7)
    camera((0, -18, 1.0), (0, 0, 0), 50)
    render('lab_vortex')

def c_gift():
    """05 result — the year, wrapped: a pearl gift box tied with ultramarine tape, records escaping."""
    setup(2880, 2160, 140, env_strength=0.45); rig(0.62)
    root = empty('gift', (0, 0, -0.3), (math.radians(18), 0, math.radians(-28)), 1.0)
    box('body', (3.0, 3.0, 2.2), 'white', (0, 0, 0), root, bevel=0.12)
    lid = empty('lid', (0, 0, 1.35), (math.radians(-9), math.radians(5), 0), 1.0); lid.parent = root
    box('lid_top', (3.25, 3.25, 0.55), 'white', (0, 0, 0), lid, bevel=0.1)
    for rot in (0, 90):
        b = box('band', (0.42, 3.08, 2.22), 'ultra', (0, 0, 0), root, bevel=0.03); b.rotation_euler = (0, 0, math.radians(rot))
        l = box('lidband', (0.44, 3.32, 0.58), 'ultra', (0, 0, 0), lid, bevel=0.03); l.rotation_euler = (0, 0, math.radians(rot))
    for sgn in (-1, 1):
        t = torus('bow', 0.55, 0.16, 'ultra', (sgn * 0.5, 0, 0.55), lid); t.rotation_euler = (math.radians(90), math.radians(sgn * 30), 0); t.scale = (1, 0.55, 1)
    cyl('knot', 0.24, 0.3, 'ultra', (0, 0, 0.42), lid, 32, bevel=0.06)
    rng = random.Random(14)
    for i in range(16):
        a = rng.uniform(0, 6.28); r = 2.6 + rng.random() * 2.2
        loc = Vector((math.cos(a) * r, math.sin(a) * r * 0.6, 1.6 + rng.uniform(-1.2, 2.6)))
        vinyl_fast(M_of(loc, Euler((rng.uniform(0, 6), rng.uniform(0, 6), 0)).to_matrix().to_4x4(), rng.uniform(0.35, 0.65)), 'ultra_matte' if rng.random() < .7 else 'white')
    camera((0, -15.5, 6.8), (0, 0, 0.6), 40)
    render('gift_2026')

def c_algo2():
    """07 — a smoky grey cassette being scanned; smooth tape spills out; data pixels rise out of it."""
    setup(2880, 2000, 128, glass=True, env_strength=0.6); rig(0.6, cold=True)
    cas = cassette(None, loc=(-1.0, 0, 1.4), rot=(math.radians(68), math.radians(-10), math.radians(-14)), scale=2.6, shell='smoke', tape='clay_dark', name='grey')
    for o in cas.children:
        if o.data and o.data.materials and o.data.materials[0].name in ('ultra', 'white'):
            o.data.materials.clear(); o.data.materials.append(mat('clay'))
    pts = []
    for i in range(900):
        t = i / 899; a = t * math.pi * 7; r = 0.4 + 3.4 * t
        pts.append((-1.0 + math.cos(a) * r * 1.2, -0.4 + math.sin(a * 0.8) * r * 0.5, 0.3 - 4.6 * t + 0.5 * math.sin(a * 1.3)))
    ribbon('tape', pts, 0.26, 'chrome_brushed', up=(0, 0, 1), thick=0.006)
    rng = random.Random(3)
    for i in range(170):
        h = rng.random(); a = rng.uniform(0, 6.28); r = (0.6 + rng.random() * 4) * (0.35 + h)
        s = (0.05 + rng.random() * 0.11) * math.sin(h * math.pi)
        b = box('px%d' % i, (s, s, s), 'clay' if rng.random() < .55 else ('white' if rng.random() < .3 else 'clay_dark'), (-1.0 + math.cos(a) * r, math.sin(a) * r * 0.6, 1.0 + h * 6.5))
        b.rotation_euler = (rng.uniform(0, 6), rng.uniform(0, 6), 0)
    frame = []
    for (x, y) in ((-3.6, -2.4), (3.6, -2.4), (3.6, 2.4), (-3.6, 2.4), (-3.6, -2.4)):
        frame.append((-1.0 + x, y, 2.0))
    tube('scan', frame, 0.018, 'white')
    camera((-1.5, -14.5, 6.5), (0.0, 0, 0.6), 42)
    render('algo_cassette')

SCENES = dict(algo2=c_algo2, gift=c_gift, yearrec=c_yearrec, hourglass=c_hourglass, lab2=c_lab2, minutes=c_minutes, hero=c_hero, ring365=c_ring365, history=c_history, data=c_data, lab=c_lab, story=c_story, social=c_social, algo=c_algo, final=c_final, swatches=c_swatches, exports=c_exports, vinyl=p_vinyl, cassette=p_cassette, speaker=p_speaker, mic=p_mic, headphones=p_headphones)
reset(); SCENES[SCENE]()
