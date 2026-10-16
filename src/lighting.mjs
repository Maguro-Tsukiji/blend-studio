const studio = { exposure: 1.15, environment: 1, ambient: 2, ambientColor: '#e2d9ff', key: { intensity: 3.2, color: '#ffeddf', azimuth: -31, elevation: 46 }, fill: { intensity: 1.2, color: '#9d9fff', azimuth: 121, elevation: 19 } };
export const LIGHTING_PRESETS = {
  studio: { label: 'スタジオ（標準）', ...studio },
  soft: { label: 'やわらかい', exposure: 1, environment: 1.3, ambient: 2.5, ambientColor: '#ffffff', key: { intensity: 1.8, color: '#ffffff', azimuth: -35, elevation: 35 }, fill: { intensity: 1.4, color: '#e8edff', azimuth: 45, elevation: 25 } },
  front: { label: '正面から', exposure: 1, environment: .5, ambient: 1, ambientColor: '#ffffff', key: { intensity: 3, color: '#ffffff', azimuth: 0, elevation: 15 }, fill: { intensity: .6, color: '#ffffff', azimuth: 90, elevation: 10 } },
  dramatic: { label: 'ドラマチック', exposure: 1.1, environment: .15, ambient: .3, ambientColor: '#c6ceff', key: { intensity: 5, color: '#ffcf9e', azimuth: -65, elevation: 30 }, fill: { intensity: 1.6, color: '#8eacff', azimuth: 140, elevation: 20 } },
};
const number = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
export function lightingSettings(value = {}) {
  const light = (entry, fallback) => ({ intensity: number(entry?.intensity, fallback.intensity, 0, 10), color: color(entry?.color, fallback.color), azimuth: number(entry?.azimuth, fallback.azimuth, -180, 180), elevation: number(entry?.elevation, fallback.elevation, -90, 90) });
  return { preset: Object.hasOwn(LIGHTING_PRESETS, value?.preset) ? value.preset : value?.preset === 'custom' ? 'custom' : 'studio', exposure: number(value?.exposure, studio.exposure, 0, 3), environment: number(value?.environment, studio.environment, 0, 3), ambient: number(value?.ambient, studio.ambient, 0, 5), ambientColor: color(value?.ambientColor, studio.ambientColor), key: light(value?.key, studio.key), fill: light(value?.fill, studio.fill) };
}
export function lightingPreset(name) { return lightingSettings({ ...(LIGHTING_PRESETS[name] || studio), preset: Object.hasOwn(LIGHTING_PRESETS, name) ? name : 'studio' }); }
export function applyLighting({ scene, renderer, ambient, key, fill }, settings, frame = { center: [0, 0, 0], largest: 1 }, frontYaw = 0) {
  const value = lightingSettings(settings), center = frame.center, distance = Math.max(frame.largest * 2, 1);
  renderer.toneMappingExposure = value.exposure; scene.environmentIntensity = value.environment;
  ambient.intensity = value.ambient; ambient.color.set(value.ambientColor);
  for (const [light, config] of [[key, value.key], [fill, value.fill]]) {
    const yaw = config.azimuth * Math.PI / 180 + frontYaw, pitch = config.elevation * Math.PI / 180;
    light.intensity = config.intensity; light.color.set(config.color);
    light.target.position.fromArray(center);
    light.position.set(center[0] + distance * Math.sin(yaw) * Math.cos(pitch), center[1] + distance * Math.sin(pitch), center[2] + distance * Math.cos(yaw) * Math.cos(pitch));
    light.target.updateMatrixWorld(); light.updateMatrixWorld();
  }
  return value;
}
