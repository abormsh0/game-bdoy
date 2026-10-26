"""Badawi camel: Blender rigging starter (Blender 4.x / 5.x).

Run:
    blender -b --python tools/blender/rig_camel.py -- input.glb output.glb

Produces a TEMPLATE armature next to the untouched camel mesh. Bones must be
moved onto the real landmarks and the mesh skinned by hand before production.
"""
import math
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 2:
    raise SystemExit('Usage: blender -b --python rig_camel.py -- input.glb output.glb')
source, dest = argv[:2]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError('No mesh in source')

# Report the mesh extents so the template can be moved onto the real landmarks.
# glTF import converts to Blender axes: +Z up; the template faces -Y.
for m in meshes:
    corners = [m.matrix_world @ v.co for v in m.data.vertices]
    if corners:
        lo = [min(c[i] for c in corners) for i in range(3)]
        hi = [max(c[i] for c in corners) for i in range(3)]
        print(f'MESH {m.name}: min={tuple(round(x, 3) for x in lo)} max={tuple(round(x, 3) for x in hi)}')

# Do not guess orientation: keep source mesh intact and generate a rig TEMPLATE.
bpy.ops.object.armature_add(enter_editmode=True)
rig = bpy.context.object
rig.name = 'Camel_Rig_TEMPLATE'
arm = rig.data
arm.name = 'Camel_Bones'
arm.edit_bones.remove(arm.edit_bones[0])


def bone(name, head, tail, parent=None):
    b = arm.edit_bones.new(name)
    b.head = head
    b.tail = tail
    if parent:
        b.parent = arm.edit_bones[parent]
    return b


bone('root', (0, 0, 0), (0, 0, .15))
bone('body', (0, 0, .15), (0, 0, .55), 'root')
bone('neck', (0, -.15, .48), (0, -.35, .8), 'body')
bone('head', (0, -.35, .8), (0, -.48, .85), 'neck')
bone('tail', (0, .3, .42), (0, .48, .34), 'body')
# The animal faces -Y, so its left side is +X. The .L/.R suffix lets Blender's
# X-mirror, Symmetrize and Paste Flipped pair the legs.
for side, x in (('L', .2), ('R', -.2)):
    for label, y in (('front', -.24), ('hind', .24)):
        upper = f'{label}_upper.{side}'
        lower = f'{label}_lower.{side}'
        foot = f'{label}_foot.{side}'
        bone(upper, (x, y, .48), (x, y, .26), 'body')
        bone(lower, (x, y, .26), (x, y, .07), upper)
        bone(foot, (x, y, .07), (x, y - .07, .035), lower)
bpy.ops.object.mode_set(mode='OBJECT')

# No automatic binding: this source is highly flattened along one axis.
# Blind weighting would distort the animal. Leave geometry unmodified.
for m in meshes:
    m['rig_status'] = 'UNBOUND: inspect orientation, proportions, and landmarks first'
rig['rig_status'] = 'TEMPLATE_ONLY: bones need repositioning and skin weights'

# Template cycles on the armature, NOT on the camel mesh. Diagonal legs move
# together (front.L with hind.R) as a placeholder gait.
rig.animation_data_create()
for pb in rig.pose.bones:
    pb.rotation_mode = 'XYZ'


def pose_angle(pb, clip, phase):
    if 'upper' in pb.name and clip != 'Idle_TEMPLATE':
        diagonal = pb.name in ('front_upper.L', 'hind_upper.R')
        amp = .18 if clip == 'Walk_TEMPLATE' else .32
        return amp * math.sin(phase + (0 if diagonal else math.pi))
    if pb.name == 'neck':
        return .025 * math.sin(phase)
    return 0.0


for clip, period in (('Idle_TEMPLATE', 48), ('Walk_TEMPLATE', 32), ('Run_TEMPLATE', 20)):
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    rig.animation_data.action = action
    # Quarter-cycle keys; the last key repeats the first so the clip loops cleanly.
    for k in range(5):
        frame = 1 + round(k * period / 4)
        for pb in rig.pose.bones:
            pb.rotation_euler = (pose_angle(pb, clip, 2 * math.pi * k / 4), 0, 0)
            pb.keyframe_insert(data_path='rotation_euler', frame=frame, group=pb.name)
    action['note'] = 'Template motion only; not applied to mesh'
    # Park each clip on a muted NLA track so none is left as the active action
    # and all three survive saving the .blend for manual cleanup.
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = clip
    track.mute = True
    track.strips.new(clip, 1, action)

bpy.context.scene.frame_set(1)

# Export scene with template armature. Not a game-ready animated camel.
bpy.ops.export_scene.gltf(filepath=dest, export_format='GLB', export_animations=True)
print('TEMPLATE EXPORTED:', dest)
