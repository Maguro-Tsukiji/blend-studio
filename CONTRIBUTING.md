# Contributing to Blend Studio

不具合報告・提案・Pull Requestを歓迎します。私有モデル、個人のパス、APIキーは公開しないでください。

## Development

Use Node.js 22 or newer. Run commands from the repository root:

```sh
npm ci
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:43123`. The bundled Studio Companion is a project-owned fixture with textured PBR and MToon materials. The standalone preview does not connect to host chat. UI text is currently Japanese.

`npm test` covers GLB validation, chunk uploads, the stdio MCP protocol, and surface-point geometry, including skinned and morphed meshes. Blender-dependent tests skip unless explicitly enabled. Build before running protocol tests because they start the bundled server.

On Windows, optional Blender tests can be enabled in PowerShell:

```powershell
$env:TEST_BLENDER_PATH = 'C:\Program Files\Blender Foundation\Blender\blender.exe'
$env:BLENDER_PATH = $env:TEST_BLENDER_PATH
$env:BLENDER_TEST_FILE = (Resolve-Path .\assets\textured-test.blend).Path
npm test
```

Replace the example executable path with your own. The settings test uses a separate temporary configuration directory. Do not point installer tests at your normal Codex configuration.

## Layout

| Path | Purpose |
|---|---|
| `src/` | Three.js viewer, material rendering, picking and model context |
| `server/` | MCP tools, file validation, uploads, configuration and preview HTTP server |
| `scripts/convert_blend.py` | Blender background conversion with automatic script execution disabled |
| `scripts/` | Build, distribution, fixture generation and installation verification |
| `skills/` | Instructions exposed to the host agent |
| `tests/` | Unit/protocol tests and development host fixtures |
| `assets/` | Logo and redistributable sample models |
| `schemas/` | Vendored manifest schemas and their license |

Run `npm run package` for a bundled distribution and `npm run export:source` for a clean source folder. Both regenerate their own folders under `release/`; do not store work there. Generated bundles, `node_modules`, private models, logs and local test reports do not belong in Git.

## UI and host verification

For a viewer change, check the supplied GLB, object/material selection, Original/PBR/MToon/Wire modes, both themes, narrow layouts, and any affected file handling. For point selection, check placement, camera rotation/zoom, clearing, model replacement, and the context received by the host.

`tests/texture-sandbox-server.mjs` is a local AppBridge fixture with restrictive CSP. It loads the bundled Blend fixture by default and needs Blender; `TEXTURE_TEST_FILE` can select a GLB instead. Start it with `node tests/texture-sandbox-server.mjs` and inspect `http://127.0.0.1:43127`. This fixture is for development, not a public server. Its script policy deliberately restricts WebAssembly; compressed assets may need a different host policy.

Host integration must also be checked in the intended desktop host. Metadata/resource verification does not prove that every host exposes the same sidebar or composer entry. Windows installation has been tested; macOS/Linux GUI installation remains unverified.

## Reporting and pull requests

- Include the app version, OS, Node/Blender/host versions, file format, reproduction steps, and the observed error.
- Prefer the bundled sample or a minimal model you have permission to redistribute. Remove identifying paths and private metadata from logs/screenshots.
- Describe the problem and the resulting behavior in a PR. Include relevant test results and any host checks you performed.
- Keep runtime versions consistent across manifests, server status, UI resource URIs and installer verification when preparing a release.
- Do not add credentials, generated diagnostic files, or unlicensed models. Update both READMEs if user-visible behavior changes.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) rather than opening a public issue with exploit details.

Contributions are provided under the project's [MIT license](LICENSE). Third-party code and assets must retain their original license and attribution. This project does not require a separate CLA.
