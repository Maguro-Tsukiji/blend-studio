<img src="assets/logo.svg" width="64" height="64" alt="Blend Studio icon">

# Blend Studio

**Inspect a 3D model, mark a location, and discuss the change in chat.**

[日本語](README.md) · [Releases](https://github.com/Maguro-Tsukiji/blend-studio/releases) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

[![Build and test](https://github.com/Maguro-Tsukiji/blend-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/Maguro-Tsukiji/blend-studio/actions/workflows/ci.yml)

Blend Studio is a local MCP Apps / OpenAI MCP Extensions plugin for `.blend`, `.glb`, and `.vrm` files. It combines PBR and MToon rendering with object/material selection and a surface marker that provides spatial context to the host's chat.

**Version 0.1.9 is experimental. Viewing and edit-location context are implemented. Live Blender editing and Tripo generation are planned integrations.**

![Surface marker on the bundled Studio Companion demo](docs/images/surface-point.png)

*The screenshot uses the project's own demo in the standalone preview; it is not connected to a host chat.*

## Features

- View embedded-texture GLB files and VRM 0.x / 1.0 models.
- Convert `.blend` files to a preview GLB with local Blender, without overwriting the source.
- Switch between original materials, PBR, MToon preview, and wireframes.
- Select objects and materials, or place marker ① on a specific surface point.
- Share the current asset, selection, marker, materials, and camera as model context.
- Keep separate camera, render-mode, selection and marker state in internal model tabs.
- Deliver a revised file to the originating view and choose whether to replace its source tab or open a new tab.
- Rotate, zoom, switch themes, and save screenshots including the marker.
- Configure Blender from the UI, including after installation.

## Requirements and compatibility

Use Node.js **22 or newer** and a host supporting **local stdio MCP, MCP Apps, and model-context updates**. Blender is required only for `.blend` conversion.

Installation has been verified on **Windows in the Codex desktop environment**. Rendering and context transfer were also checked with the official AppBridge. macOS/Linux executable detection exists, but installation and GUI behavior on those platforms remain unverified. The CLI alone does not display this 3D UI.

This distribution runs a local process. Publishing a GitHub repository does not connect it to ChatGPT web or publish it in the public plugin directory. Host surfaces such as sidebar entries vary by client; see the [official packaging guide](https://developers.openai.com/plugins/build/plugins).

## Install on Windows

1. Download the **[v0.1.9 built ZIP](https://github.com/Maguro-Tsukiji/blend-studio/releases/download/v0.1.9/Blend-Studio-0.1.9.zip)**. Check [Releases](https://github.com/Maguro-Tsukiji/blend-studio/releases) for newer versions.
2. Extract the entire ZIP.
3. Double-click `blend-studio/Install-Blend-Studio.cmd`.
4. Wait for the completion message, then restart the supported desktop host.
5. Select Blend Studio and ask the host to open it.

The installer detects Node.js and Codex; it does not download them. Configure Blender later through **設定 → 参照…**. The GitHub **Download ZIP** option provides source code and requires a build. The detailed [installation guide](docs/INSTALLATION.md) is currently in Japanese; the application UI is also Japanese.

## Mark a location

Open a model, click **場所を指定**, and click the surface to place marker ①. After **チャットへ位置を共有しました** appears, describe the change in the host chat, such as “Make the hair tip at ① shorter.”

One location can be marked per tab. Camera changes and render-mode switches keep the marker. Selecting another object/material or replacing that tab's model clears it. Enter marks the surface at the viewport center; Escape cancels placement mode. Images are not sent automatically. A standalone preview can save a marked screenshot for manual attachment.

## Open a revised file in the originating view

After a separate editing tool creates a revised local file, ask the host chat to open it in the Blend Studio view where you requested the edit. Using that request's saved view/tab context, the agent calls `studio.open_revision`. The original view offers **修正依頼元のタブを更新** (replace the source tab) and **新しいタブで開く** (open a new internal tab), even when you are viewing a different tab.

A new tab preserves the original model's camera, render mode, selection and marker. Ordinary file imports also offer replace/new-tab choices; the tab bar's **＋** always adds a tab and **×** closes one. Tabs exist only in memory and are lost when the view closes. This flow updates the preview without overwriting the source file, and requires the originating view and source context to remain available. Actual Blender editing and Tripo generation are still separate planned integrations. See [ADAPTERS.md](docs/ADAPTERS.md) for the tool protocol.

## Build and preview

From the repository root:

```sh
npm ci
npm run build
npm test
npm run preview
```

Open `http://127.0.0.1:43123`. The standalone preview does not connect to a host chat. Stop it with Ctrl+C. An installed MCP App is delivered by the host and does not need this preview server.

`npm run package` produces a built plugin folder. `npm run export:source` produces the clean source tree intended for repository publication. See [CONTRIBUTING.md](CONTRIBUTING.md) and [the publishing guide](docs/PUBLISHING.md).

## Limits and data handling

Blender conversion preserves what its glTF exporter supports, principally PBR and embedded images. Arbitrary Blender shader graphs and Blender-specific effects are not fully preserved; Blender MToon node graphs are not automatically converted to a glTF MToon extension.

Draco, KTX2, and externally referenced GLB resources are unsupported. Meshopt requires WebAssembly support from the host. Rigs are displayed, but there is no animation playback UI. Files are limited to 256 MiB. A view holds up to eight model tabs and 512 MiB of loaded GLB data; actual rendering memory can be larger. The server also caps retained assets, so older assets may need to be reloaded.

Marker coordinates and triangle indices refer to the preview, not directly to the original Blender mesh. Applying actual edits requires a separately connected editing tool and source reconciliation.

Model processing and rendering happen locally. The plugin does not send the model binary to an external service. Chat integration does share names, selection, point coordinates, and camera information with the host; the host's own storage and transmission policies apply. See [SECURITY.md](SECURITY.md) for implementation boundaries and vulnerability reporting.

## License and contributions

Project code and original demo assets use the [MIT License](LICENSE). Dependency licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); vendored schemas have [separate attribution](schemas/README.md). Imported model and texture rights remain with their respective owners.

Issues and pull requests are welcome. Follow [CONTRIBUTING.md](CONTRIBUTING.md), and avoid sharing private models, credentials, or personal paths in reports.

Blend Studio is an independent project and is not an official OpenAI, Blender, or Tripo product.
