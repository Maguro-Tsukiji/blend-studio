import bpy
import json
import sys

source, destination, report_path = sys.argv[sys.argv.index('--') + 1:]
# A fresh background process never modifies the user's open Blender or source file.
bpy.ops.wm.open_mainfile(filepath=source, load_ui=False, use_scripts=False)

def has_mtoon_source(mat):
    if not mat.use_nodes:
        return False
    nodes = mat.node_tree.nodes
    # The VRM add-on keeps a Principled compatibility output alongside MToon.
    # A factory-startup glTF export sees only that output, losing the toon origin.
    is_mtoon_output = lambda node: node.type == 'GROUP' and node.node_tree and node.node_tree.name.startswith('VRM Add-on MToon 1.0 Output')
    has_mtoon_group = any(is_mtoon_output(node) for node in nodes)
    pending = [node for node in nodes if node.type == 'OUTPUT_MATERIAL' and node.is_active_output]
    visited = set()
    while pending:
        node = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        if is_mtoon_output(node) or (has_mtoon_group and node.type == 'BSDF_PRINCIPLED' and node.name == 'Mtoon1Material.CompatibleShader'):
            return True
        pending.extend(link.from_node for socket in node.inputs for link in socket.links)
    return False

objects = [{'name': o.name, 'type': o.type, 'materials': [s.material.name if s.material else None for s in o.material_slots]} for o in bpy.context.scene.objects]
warnings = ['Blenderの表示はglTFへ変換したプレビューです。任意のシェーダーノード、コンポジット、レンダーエンジン固有の効果は完全には再現できません。']
mtoon_count = 0
for mat in bpy.data.materials:
    if has_mtoon_source(mat):
        # Preview-only extra, exported into GLB and read by the lighting chooser.
        # Never save these in-memory changes back to the user's Blend file.
        mat['blendStudioSourceShader'] = 'MToon'
        mtoon_count += 1
    if mat.use_nodes:
        principled = any(node.type == 'BSDF_PRINCIPLED' for node in mat.node_tree.nodes)
        if not principled:
            warnings.append('マテリアル「' + mat.name + '」: Principled BSDF以外のシェーダーはPBRに近似される場合があります。MToonを保持するにはVRM/GLBのMToon拡張付き書き出しを使用してください。')
    for node in mat.node_tree.nodes if mat.use_nodes else []:
        if node.type == 'TEX_IMAGE' and node.image and node.image.source == 'FILE':
            import os
            if not node.image.packed_file and not os.path.isfile(bpy.path.abspath(node.image.filepath)):
                warnings.append('テクスチャ「' + node.image.name + '」が見つかりません。')
if mtoon_count:
    warnings.append(str(mtoon_count) + '件のMToonマテリアルをPBRに近似します。自動ライティングの判定には変換前のMToon情報を使用します。')
# RNA-filter options for compatibility with multiple Blender versions.
options = {'filepath': destination, 'export_format': 'GLB', 'export_extras': True, 'export_yup': True, 'export_materials': 'EXPORT', 'export_animations': True, 'export_apply': False, 'use_selection': False}
supported = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})
with open(report_path, 'w', encoding='utf-8') as stream:
    json.dump({'blenderVersion': bpy.app.version_string, 'objects': objects, 'warnings': warnings}, stream, ensure_ascii=False)
print('Blend Studio: conversion complete')
