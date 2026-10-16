import bpy
import sys

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
group = bpy.data.node_groups.new('VRM Add-on MToon 1.0 Output Revision 1', 'ShaderNodeTree')
for index, name in enumerate(['Converted Toon', 'Plain PBR', 'Unused Toon Nodes']):
    bpy.ops.mesh.primitive_cube_add(location=(index * 3, 0, 0))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    if index == 0:
        shader.name = 'Mtoon1Material.CompatibleShader'
    if index != 1:
        node = mat.node_tree.nodes.new('ShaderNodeGroup')
        node.node_tree = group
    bpy.context.object.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[sys.argv.index('--') + 1])
