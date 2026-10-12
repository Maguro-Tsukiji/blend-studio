import { TextureLoader } from 'three';

function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function embeddedTexturePlugin(manager) {
  return parser => ({
    name: 'BLEND_STUDIO_LOCAL_TEXTURES',
    async beforeRoot() {
      // Keep embedded image decoding local. ImageBitmapLoader uses fetch,
      // and fetching blob/data URLs is restricted in MCP App sandboxes.
      // Image elements with data URLs do not require connect-src access.
      parser.textureLoader = new TextureLoader(manager);
      for (const image of parser.json.images || []) {
        if (image.bufferView === undefined) continue;
        const mimeType = image.mimeType;
        if (!/^image\/(png|jpeg|webp|avif)$/.test(mimeType || '')) throw new Error('対応していないテクスチャ画像です。PNG/JPEG形式で保存してください。');
        const bytes = new Uint8Array(await parser.getDependency('bufferView', image.bufferView));
        image.uri = `data:${mimeType};base64,${base64(bytes)}`;
        delete image.bufferView;
      }
    },
  });
}
