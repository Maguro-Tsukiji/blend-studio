# Changelog

Version 0.1.8 is the first public GitHub release. Earlier versions describe local development milestones, not separate public releases.

## Unreleased

No changes yet.

## 0.1.14 — 2026-10-17

- Preserve recognized Blender VRM Add-on MToon 1.0 material origin in preview GLB extras. Use that hint for Original-mode lighting instead of incorrectly selecting strong PBR defaults after conversion.
- Label these materials as PBR approximations of MToon and expose their source shader during inspection; do not claim full shader preservation or modify saved source files.
- Retain lighting on ordinary same-tab file replacement, including manual adjustments. Keep new-tab lighting independent.
- Add an original Blender fixture and end-to-end conversion/GLTFLoader regression coverage, including plain PBR and disconnected MToon nodes.

## 0.1.13 — 2026-10-16

- Separate PBR and MToon lighting profiles. Use restrained MToon Studio values (exposure 0.8, hemisphere 0.2, key 1.0, fill 0.2) and reduce the other toon presets to preserve pale detail.
- Detect native MToon materials in Original mode and follow render-mode changes while defaults remain automatic. Keep existing PBR preset values.
- Preserve explicitly selected presets and manual edits across mode/tab changes and working revisions; reset restores the current renderer’s automatic defaults. Indicate the active profile and automatic/manual behavior in the panel and host context.
- Restore tab lighting before applying its render mode to prevent outgoing settings from overwriting incoming model state. Add profile detection, transitions, legacy/manual preservation and preset regression coverage.

## 0.1.12 — 2026-10-16

- Add live preview lighting controls for exposure, PBR environment, hemisphere light and independent key/fill intensity, color and direction.
- Add Studio, Soft, Front and Dramatic presets, color picker/hex input and reset. Keep lights relative to the configured model front instead of the camera.
- Retain lighting per model tab and across same-session revisions/working-file refreshes, and share settings with host model context. Source files are unchanged.
- Verify bounded settings, independent snapshots, actual Three.js light application and model-relative placement.

## 0.1.11 — 2026-10-16

- Play self-contained VRMA motion on skinned humanoid Blend/GLB/VRM previews with play/pause, stop, seek, speed and loop controls. Add automatic and manual bone mapping for ordinary T-pose rigs.
- Reapply motion, bone mapping and playback state after a saved working-file refresh or same-session revision. Playback is preview-only and does not bake animation into Blender.
- Add front, character-left, character-right and back orthographic views, free 3D orbit and a configurable front direction.
- Mark up to eight surface locations per tab, remove points individually without renumbering, and share labeled targets plus animation/camera state with host chat. Points follow skinned and morphed surfaces.
- Add original weighted humanoid and VRMA fixtures, retargeting/camera/multi-point regression tests, and dismissible notifications so conversion notices do not cover playback controls.

## 0.1.10 — 2026-10-15

- Follow a saved Blender/GLB/VRM working file in its original tab, with automatic save detection, manual refresh and disconnect controls.
- Preserve camera, render mode and preview placement on working-file refresh; clear outdated selections/markers and retain the old preview if loading fails.
- Add stable editing-session IDs and session discovery so repeated revisions and missing chat context do not force another viewer to open.
- Share small routing records across local MCP processes and load revisions on the receiving app connection; retain inactive metadata for up to 24 hours until cleanup.
- Verify separate-process routing, stale-session rejection, overlapping saves and working-file updates. Remove temporary conversion outputs after reading them.

## 0.1.9 — 2026-10-12

- Add internal model tabs with separate camera, render mode, selection, grid and surface-marker state.
- Offer a replace/new-tab choice when opening files; preserve the current model if loading fails or is cancelled.
- Add `studio.open_revision` to deliver a revised file to the originating view and source tab without opening another host window.
- Include view/tab identifiers in chat context, acknowledge deliveries, and reject stale or unavailable source targets.
- Document the revision workflow and verify tab state, delivery isolation and MCP routing.

## 0.1.8 — 2026-10-12

First public release, marked as an experimental preview.

- Japanese and English README, installation/troubleshooting, contribution, security and release guides.
- Community issue/PR templates and build/test CI configuration.
- Reproducible repository-local packaging and clean source export; vendored manifest schemas with license attribution.
- Public screenshots and fixtures use only project-owned sample assets.

- Pick a specific model surface point and display a persistent ① marker.
- Share its source object/material, preview triangle, barycentric weights, optional UV and camera context with the host chat.
- Preserve the target while orbiting/zooming; clear it on file or selection changes.
- Account for skin/morph deformation and transparent texture pixels during picking.

## 0.1.7

- Use the same purple Blend Studio icon in the plugin listing, app header and favicon.

## 0.1.6

- Remove the duplicate viewer chat form; send selection/context updates to the host's MCP Extensions chat.

## 0.1.5

- Make the Windows CMD installer show progress, errors and completion, and keep its console open for review.

## 0.1.4

- Reuse an identical installed package to avoid locked-cache backup failures on Windows.

## 0.1.3

- Load embedded textures under restrictive MCP Apps CSP without requiring network access.

## 0.1.2

- Use a host-compatible Node launch command.
- Allow Blender configuration after skipping initial setup and preserve it outside the plugin cache.

## 0.1.0–0.1.1

- Initial local Blend/GLB/VRM viewer, textured PBR/MToon rendering, selection, themes and preview conversion.
- Local plugin manifests, Windows installation and stdio host verification.
