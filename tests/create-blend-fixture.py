import bpy
import sys
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_cube_add(size=2, location=(0,0,1))
cube=bpy.context.object
cube.name='Textured Cube'
mat=bpy.data.materials.new('Packed Checker')
mat.use_nodes=True
shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
shader.inputs['Base Color'].default_value=(0.5,0.2,0.8,1)
shader.inputs['Roughness'].default_value=0.4
image=bpy.data.images.new('Embedded checker',width=4,height=4)
image.pixels=[v for y in range(4) for x in range(4) for v in ((0.7,0.45,0.9,1) if (x+y)%2 else (1,1,1,1))]
image.pack()
node=mat.node_tree.nodes.new('ShaderNodeTexImage')
node.image=image
mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
cube.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[sys.argv.index('--')+1])
