# Changelog

Version 0.1.8 is the first public GitHub release. Earlier versions describe local development milestones, not separate public releases.

## Unreleased

No changes yet.

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
