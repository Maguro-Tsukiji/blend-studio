param([string]$BlenderPath, [int]$Port = 43123)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22以上をインストールしてください。' }
$taskNodeVersion = & node --version
if ([int]($taskNodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22以上が必要です。' }
if ($BlenderPath) {
  if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw 'Blenderの実行ファイルが見つかりません。' }
  $env:BLENDER_PATH = (Resolve-Path -LiteralPath $BlenderPath).Path
}
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Portは1024〜65535を指定してください。' }
$env:PORT = [string]$Port
Write-Host "ブラウザーで http://127.0.0.1:$Port を開いてください。終了は Ctrl+C です。"
& node (Join-Path $PSScriptRoot 'server\preview.bundle.mjs')
