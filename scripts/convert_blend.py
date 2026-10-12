import bpy
import json
import sys

source, destination, report_path = sys.argv[sys.argv.index('--') + 1:]
# A fresh background process never modifies the user's open Blender or source file.
bpy.ops.wm.open_mainfile(filepath=source, load_ui=False, use_scripts=False)
objects = [{'name': o.name, 'type': o.type, 'materials': [s.material.name if s.material else None for s in o.material_slots]} for o in bpy.context.scene.objects]
warnings = ['Blenderの表示はglTFへ変換したプレビューです。任意のシェーダーノード、コンポジット、レンダーエンジン固有の効果は完全には再現できません。']
for mat in bpy.data.materials:
    if mat.use_nodes:
        principled = any(node.type == 'BSDF_PRINCIPLED' for node in mat.node_tree.nodes)
        if not principled:
            warnings.append('マテリアル「' + mat.name + '」: Principled BSDF以外のシェーダーはPBRに近似される場合があります。MToonを保持するにはVRM/GLBのMToon拡張付き書き出しを使用してください。')
    for node in mat.node_tree.nodes if mat.use_nodes else []:
        if node.type == 'TEX_IMAGE' and node.image and node.image.source == 'FILE':
            import os
            if not node.image.packed_file and not os.path.isfile(bpy.path.abspath(node.image.filepath)):
                warnings.append('テクスチャ「' + node.image.name + '」が見つかりません。')
# RNA-filter options for compatibility with multiple Blender versions.
options = {'filepath': destination, 'export_format': 'GLB', 'export_extras': True, 'export_yup': True, 'export_materials': 'EXPORT', 'export_animations': True, 'export_apply': False, 'use_selection': False}
supported = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})
with open(report_path, 'w', encoding='utf-8') as stream:
    json.dump({'blenderVersion': bpy.app.version_string, 'objects': objects, 'warnings': warnings}, stream, ensure_ascii=False)
print('Blend Studio: conversion complete')
