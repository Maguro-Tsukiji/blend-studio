# Security and data handling

## Reporting a vulnerability

If the repository's **Security → Report a vulnerability** action is available, use it for a private report. Include affected versions, reproduction steps, impact and a minimal fixture that you are allowed to share.

If private reporting is not enabled, open an issue asking the maintainers for a private reporting channel. Do not include exploit details, credentials, private models, screenshots containing personal information, or unredacted local paths in a public issue. No dedicated contact address or response-time commitment has been established yet.

This is an experimental project. There is no guaranteed security support window for older releases; fixes will target the current development version.

## Runtime boundaries

- The stdio MCP server runs with the current user's privileges. `studio.open` can read a local file path passed by the host. The host's tool permissions are part of the trust boundary; the server does not provide a workspace-only filesystem sandbox.
- Blend conversion starts a separate Blender process with `--factory-startup` and `--disable-autoexec`. It writes a temporary preview and does not save over the original Blend. These flags do not sandbox Blender's native parsers or external image reads. Use trusted model files and a maintained Blender installation.
- The viewer's textures come from embedded model data. GLB validation rejects external buffer/image references; arbitrary remote URL loading is not a feature.
- Uploaded Blend files and conversion artifacts live in an OS temporary directory. Normal shutdown removes the session directory; a crash or forced termination can leave it behind.
- The preview HTTP server binds to `127.0.0.1`, checks Host/Origin and accepts JSON requests. It has no authentication and is intended only for local development. Do not expose it through a proxy, tunnel or public interface.
- Blender configuration stores a local executable path. It validates the basename and version before saving; it is not an executable trust-verification system.
- The Windows installer copies/registers a local plugin for the current user. It does not require administrator privileges or terminate other applications to bypass a file lock.

## What reaches host chat

The plugin shares model context: filename, asset identifier, object/material names and indices, rendering mode, selected surface coordinates, optional UV, and camera information. This may contain confidential names. Host storage and transmission depend on the host's settings and policies.

The plugin does not upload model binaries to an external generation service. Screenshots are saved on explicit user action and are not automatically sent. Future Blender editing and Tripo integrations are not implemented and will need their own permission/data handling design.

## Public contributions

Do not commit real user models, installation records, settings, environment files, logs, or diagnostic screenshots. The clean source exporter uses an allowlist and excludes generated bundles and test reports. Review the actual exported contents before publishing; an automated scan is not a substitute for reviewing asset rights and confidential metadata.
