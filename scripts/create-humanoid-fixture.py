"""Project-owned, weighted T-pose fixture. Run in a factory-startup Blender."""
import bpy
import math
import os
import sys
from mathutils import Vector

output = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
data = bpy.data.armatures.new('Studio Humanoid')
armature = bpy.data.objects.new('Studio Humanoid', data)
bpy.context.collection.objects.link(armature)
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
definitions = [
    ('hips', None, (0, 0, 1), (0, 0, 1.16)),
    ('spine', 'hips', (0, 0, 1.16), (0, 0, 1.4)),
    ('chest', 'spine', (0, 0, 1.4), (0, 0, 1.62)),
    ('neck', 'chest', (0, 0, 1.62), (0, 0, 1.76)),
    ('head', 'neck', (0, 0, 1.76), (0, 0, 2.06)),
]
for side, sign in [('left', 1), ('right', -1)]:
    definitions.extend([
        (side + 'UpperArm', 'chest', (.22 * sign, 0, 1.57), (.58 * sign, 0, 1.57)),
        (side + 'LowerArm', side + 'UpperArm', (.58 * sign, 0, 1.57), (.9 * sign, 0, 1.57)),
        (side + 'Hand', side + 'LowerArm', (.9 * sign, 0, 1.57), (1.07 * sign, 0, 1.57)),
        (side + 'UpperLeg', 'hips', (.15 * sign, 0, 1), (.15 * sign, 0, .56)),
        (side + 'LowerLeg', side + 'UpperLeg', (.15 * sign, 0, .56), (.15 * sign, 0, .13)),
        (side + 'Foot', side + 'LowerLeg', (.15 * sign, 0, .13), (.15 * sign, -.2, .08)),
    ])
for name, parent, head, tail in definitions:
    bone = data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
palette = {}
for name, color in [('Shell', (.57, .38, .83, 1)), ('Face', (.92, .83, .98, 1)), ('Accent', (.15, .1, .25, 1))]:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = color
    palette[name] = material
for name, parent, head, tail in definitions:
    if name == 'neck':
        continue
    head, tail = Vector(head), Vector(tail)
    if name == 'head':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=.25, location=(0, -.015, 1.92))
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(head + tail) / 2)
        width = .28 if name in ['hips', 'spine', 'chest'] else .12
        bpy.context.object.scale = (width, .18 if name in ['hips', 'spine', 'chest'] else width, (tail - head).length * .94)
        bpy.context.object.rotation_mode = 'QUATERNION'
        bpy.context.object.rotation_quaternion = (tail - head).to_track_quat('Z', 'Y')
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mesh = bpy.context.object
    mesh.name = name + ' Mesh'
    mesh.data.materials.append(palette['Face' if name == 'head' else 'Accent' if 'Hand' in name or 'Foot' in name else 'Shell'])
    group = mesh.vertex_groups.new(name=name)
    group.add(list(range(len(mesh.data.vertices))), 1, 'REPLACE')
    modifier = mesh.modifiers.new('Humanoid skin', 'ARMATURE')
    modifier.object = armature
    mesh.parent = armature
# A front-facing detail makes the camera presets visually verifiable.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -.25, 1.94), scale=(.25, .025, .06))
mesh = bpy.context.object
mesh.name = 'Front visor'
mesh.data.materials.append(palette['Accent'])
group = mesh.vertex_groups.new(name='head')
group.add(list(range(len(mesh.data.vertices))), 1, 'REPLACE')
modifier = mesh.modifiers.new('Humanoid skin', 'ARMATURE')
modifier.object = armature
mesh.parent = armature
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output, 'humanoid-test.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(output, 'humanoid-test.glb'), export_format='GLB', export_yup=True, export_animations=False)
