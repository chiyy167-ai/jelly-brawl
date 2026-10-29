"""用参考图的造型，在 Blender 里生成 BananaPeel 并导出 banana_peel.glb。

规格：高 0.35 m，最大宽度 0.45 m，厚度约 0.15 m。
五片独立弯曲果皮，再合并成一个网格；蒂和橙色末端单独材质。
参考图：同目录 banana-peel-ref.png（渲染参考，不是贴图）。
"""
import math
import os

import bpy
from mathutils import Vector

OUT = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    '..', 'public', 'models', 'items', 'banana_peel.glb',
))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0


def make_mat(name, color, rough, coat):
    mat = bpy.data.materials.new(name)
    # Blender 5 起材质默认就是节点；6.0 会去掉 use_nodes
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    coat_key = 'Coat Weight' if 'Coat Weight' in bsdf.inputs else 'Clearcoat'
    if coat_key in bsdf.inputs:
        bsdf.inputs[coat_key].default_value = coat
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.55
    return mat


YELLOW = make_mat('PeelYellow', (1.0, 0.84, 0.08), 0.18, 0.65)
ORANGE = make_mat('PeelTip', (1.0, 0.45, 0.06), 0.22, 0.45)
GREEN = make_mat('StemGreen', (0.42, 0.78, 0.18), 0.32, 0.25)
CAP = make_mat('StemCap', (0.78, 0.42, 0.08), 0.28, 0.4)


def quad(p0, p1, p2, n):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1.0 - t
        pts.append((
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
            u * u * p0[2] + 2 * u * t * p1[2] + t * t * p2[2],
            1.0 - 0.12 * t,
        ))
    return pts


def curve_mesh(name, samples, radius, material):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 8
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(samples) - 1)
    for bp, (x, y, z, rad) in zip(sp.bezier_points, samples):
        bp.co = (x, y, z)
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
        bp.radius = rad
    obj = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.view_layer.objects.active
    obj.data.materials.append(material)
    obj.select_set(False)
    return obj


# 五片果皮先向外鼓，再垂到橙色末端，避免变成五根直管。
PEELS = [
    ((0.0, 0.0, 0.20), (-0.13, 0.01, 0.12), (-0.17, 0.01, 0.045)),
    ((0.0, 0.0, 0.20), (-0.09, 0.04, 0.11), (-0.09, 0.045, 0.015)),
    ((0.0, 0.0, 0.20), (0.01, 0.05, 0.10), (0.0, 0.035, 0.0)),
    ((0.0, 0.0, 0.20), (0.10, 0.035, 0.11), (0.10, 0.04, 0.015)),
    ((0.0, 0.0, 0.20), (0.14, -0.01, 0.12), (0.17, -0.01, 0.045)),
]

peels = []
tips = []
for i, (a, b, c) in enumerate(PEELS):
    samples = quad(a, b, c, 7)
    peels.append(curve_mesh(f'Peel_{i}', samples, 0.034, YELLOW))
    tip_at = samples[-1]
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=10, radius=1.0,
        location=(tip_at[0], tip_at[1], tip_at[2]),
    )
    tip = bpy.context.view_layer.objects.active
    tip.name = f'Tip_{i}'
    tip.scale = (0.055, 0.036, 0.032)
    tilt = math.atan2(c[0] - b[0], c[2] - b[2])
    tip.rotation_euler = (0.4, tilt, 0.0)
    tip.data.materials.append(ORANGE)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tips.append(tip)

stem = curve_mesh('Stem', quad((0, 0, 0.18), (0, 0, 0.26), (0.0, 0, 0.33), 5), 0.016, GREEN)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.022, location=(0.004, 0, 0.325))
cap = bpy.context.view_layer.objects.active
cap.name = 'StemCap'
cap.scale = (1.15, 1.05, 0.7)
cap.data.materials.append(CAP)
bpy.context.view_layer.objects.active = cap
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

parts = peels + tips + [stem, cap]
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = peels[0]
bpy.ops.object.join()
peel = bpy.context.view_layer.objects.active
peel.name = 'BananaPeel'

# 缩放到指定外形，底面落到 z=0，水平居中。
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
xs, ys, zs = [], [], []
for corner in peel.bound_box:
    w = peel.matrix_world @ Vector(corner)
    xs.append(w.x)
    ys.append(w.y)
    zs.append(w.z)
height = max(zs) - min(zs)
width = max(xs) - min(xs)
depth = max(ys) - min(ys)
sx = 0.45 / max(width, 1e-6)
sy = 0.15 / max(depth, 1e-6)
sz = 0.35 / max(height, 1e-6)
peel.scale = (sx, sy, sz)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

xs, ys, zs = [], [], []
for corner in peel.bound_box:
    w = peel.matrix_world @ Vector(corner)
    xs.append(w.x)
    ys.append(w.y)
    zs.append(w.z)
peel.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True)
print('exported', OUT)
print('size_m', round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(max(zs) - min(zs), 3))
