param(
    [switch]$Headless,
    [switch]$Console,
    [string]$InstallBase,
    [string]$ConfigurationHome,
    [string]$CodexPath,
    [string]$NodePath,
    [string]$PreviewImage
)

$ErrorActionPreference = 'Stop'
$script:taskUi = $null
$script:taskBusy = $false
$script:taskMessages = [System.Collections.Generic.List[string]]::new()
$script:taskResult = $null
$script:taskConsole = $Console -and -not $Headless
$script:taskLogPath = $null
$script:taskSource = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $InstallBase) { $InstallBase = Join-Path $env:LOCALAPPDATA 'BlendStudio' }
$script:taskBase = [IO.Path]::GetFullPath($InstallBase)
if ($ConfigurationHome) { $ConfigurationHome = [IO.Path]::GetFullPath($ConfigurationHome) }

function Write-Step([string]$Message) {
    $script:taskMessages.Add($Message)
    if ($script:taskConsole) { Write-Host $Message }
    if ($script:taskLogPath) { [IO.File]::AppendAllText($script:taskLogPath, $Message + "`r`n", [Text.UTF8Encoding]::new($false)) }
    if ($script:taskUi) {
        $script:taskUi.Status.Text = $Message
        $script:taskUi.Log.Text = $script:taskMessages -join "`r`n"
        [Windows.Forms.Application]::DoEvents()
    }
}

# Quote Windows native arguments without evaluating a shell command.
function ConvertTo-NativeArgument([string]$Value) {
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Invoke-Program([string]$Executable, [string[]]$Arguments, [int]$TimeoutSeconds = 90) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.Arguments = ($Arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WorkingDirectory = $script:taskSource
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [Text.Encoding]::UTF8
    if ($ConfigurationHome) { $info.EnvironmentVariables['CODEX_HOME'] = $ConfigurationHome }
    if ($ConfigurationHome) { $info.EnvironmentVariables['BLEND_STUDIO_CONFIG_DIR'] = $script:taskBase }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        if (-not $process.Start()) { throw '登録用のプログラムを起動できませんでした。' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $timer = [Diagnostics.Stopwatch]::StartNew()
        while (-not $process.WaitForExit(100)) {
            if ($script:taskUi) { [Windows.Forms.Application]::DoEvents() }
            if ($timer.Elapsed.TotalSeconds -gt $TimeoutSeconds) {
                $process.Kill()
                throw '処理が時間内に完了しませんでした。アプリを更新して、もう一度お試しください。'
            }
        }
        $process.WaitForExit()
        return [PSCustomObject]@{ ExitCode = $process.ExitCode; Output = $stdout.Result; Error = $stderr.Result }
    } finally { $process.Dispose() }
}

function Get-CodexCandidates {
    if ($CodexPath) {
        if (-not (Test-Path -LiteralPath $CodexPath -PathType Leaf)) { throw '指定したCodexが見つかりません。' }
        return @([IO.Path]::GetFullPath($CodexPath))
    }
    $paths = [System.Collections.Generic.List[string]]::new()
    $profileRoot = [Environment]::GetFolderPath('UserProfile')
    $runtimeHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $profileRoot '.codex' }
    foreach ($location in @(
        @{ Root = (Join-Path $runtimeHome 'packages\app-server-daemon\releases'); Suffix = 'bin\codex.exe' },
        @{ Root = (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'); Suffix = 'codex.exe' }
    )) {
        if (Test-Path -LiteralPath $location.Root -PathType Container) {
            foreach ($folder in (Get-ChildItem -LiteralPath $location.Root -Directory | Sort-Object LastWriteTime -Descending)) {
                $candidate = Join-Path $folder.FullName $location.Suffix
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { $paths.Add($candidate) }
            }
        }
    }
    foreach ($command in @(Get-Command codex.exe -All -ErrorAction SilentlyContinue)) { $paths.Add($command.Source) }
    $npmRoots = [System.Collections.Generic.List[string]]::new()
    if ($env:APPDATA) { $npmRoots.Add((Join-Path $env:APPDATA 'npm\node_modules\@openai\codex')) }
    foreach ($command in @(Get-Command codex.cmd -All -ErrorAction SilentlyContinue)) {
        $npmRoots.Add((Join-Path (Split-Path -Parent $command.Source) 'node_modules\@openai\codex'))
    }
    foreach ($root in ($npmRoots | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $root -PathType Container) {
            foreach ($file in @(Get-ChildItem -LiteralPath $root -Filter codex.exe -File -Recurse -ErrorAction SilentlyContinue)) { $paths.Add($file.FullName) }
        }
    }
    return @($paths | Select-Object -Unique)
}

function Get-Requirements {
    Write-Step '必要なものを確認しています…'
    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($NodePath) { $candidates.Add([IO.Path]::GetFullPath($NodePath)) }
    else {
        foreach ($command in @(Get-Command node.exe -All -ErrorAction SilentlyContinue)) { $candidates.Add($command.Source) }
        foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
            if ($root) { $candidates.Add((Join-Path $root 'nodejs\node.exe')) }
        }
    }
    $node = $null
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $result = Invoke-Program $candidate @('--version') 10
            if ($result.ExitCode -eq 0 -and $result.Output.Trim() -match '^v(\d+)\.') {
                if ([int]$Matches[1] -ge 22) { $node = [PSCustomObject]@{ Path = $candidate; Version = $result.Output.Trim() }; break }
            }
        } catch { }
    }
    if (-not $node) { throw 'Node.js 22以上が見つかりません。「必要なソフトを開く」からNode.jsを導入して、もう一度開いてください。' }
    $codex = $null
    foreach ($candidate in @(Get-CodexCandidates)) {
        try {
            $check = Invoke-Program $candidate @('plugin', 'marketplace', 'add', '--help') 15
            if ($check.ExitCode -eq 0 -and $check.Output -match 'marketplace' -and $check.Output -match '\-\-json') {
                $version = Invoke-Program $candidate @('--version') 10
                $codex = [PSCustomObject]@{ Path = $candidate; Version = $version.Output.Trim() }; break
            }
        } catch { }
    }
    if (-not $codex) { throw 'プラグイン登録に対応したCodexが見つかりません。デスクトップアプリを更新して、もう一度開いてください。' }
    $blender = $null
    $savedSettingsPath = Join-Path $script:taskBase 'settings.json'
    if (Test-Path -LiteralPath $savedSettingsPath -PathType Leaf) {
        $savedSettings = Get-Content -LiteralPath $savedSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($savedSettings.blenderPath -and (Test-Path -LiteralPath $savedSettings.blenderPath -PathType Leaf)) { $blender = $savedSettings.blenderPath }
    }
    if (-not $blender -and $env:BLENDER_PATH -and (Test-Path -LiteralPath $env:BLENDER_PATH -PathType Leaf)) { $blender = $env:BLENDER_PATH }
    if (-not $blender) {
        $command = Get-Command blender.exe -ErrorAction SilentlyContinue
        if ($command) { $blender = $command.Source }
    }
    if (-not $blender -and $env:ProgramFiles) {
        $foundation = Join-Path $env:ProgramFiles 'Blender Foundation'
        if (Test-Path -LiteralPath $foundation -PathType Container) {
            foreach ($folder in (Get-ChildItem -LiteralPath $foundation -Directory | Sort-Object LastWriteTime -Descending)) {
                $candidate = Join-Path $folder.FullName 'blender.exe'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { $blender = $candidate; break }
            }
        }
    }
    return [PSCustomObject]@{ Node = $node; Codex = $codex; Blender = $blender }
}

function Read-ProgramJson($Result, [string]$Step) {
    if ($Result.ExitCode -ne 0) {
        $detail = ($Result.Error + "`n" + $Result.Output).Trim()
        if ($detail.Length -gt 2500) { $detail = $detail.Substring(0, 2500) }
        throw ($Step + 'に失敗しました。' + "`r`n" + $detail)
    }
    try { return ($Result.Output | ConvertFrom-Json) }
    catch { throw ($Step + 'の結果を読み取れませんでした。デスクトップアプリを更新してください。') }
}

function Get-InstalledCachePath([string]$Version) {
    $runtimeHome = if ($ConfigurationHome) { $ConfigurationHome } elseif ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex' }
    return [IO.Path]::GetFullPath((Join-Path $runtimeHome ('plugins\cache\blend-studio-local\blend-studio\' + $Version)))
}

function Get-PackageFileDigest([string]$Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToBase64String($sha.ComputeHash($stream)) }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Test-InstalledPackage([string]$Source, [string]$Installed, [string[]]$Items, [string]$NodeExecutable) {
    if (-not (Test-Path -LiteralPath $Installed -PathType Container)) { return $false }
    if ((Get-Item -LiteralPath $Installed -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { return $false }
    foreach ($name in $Items) {
        if ($name -eq 'mcp.json') { continue }
        $sourcePath = Join-Path $Source $name
        $files = if (Test-Path -LiteralPath $sourcePath -PathType Container) { @(Get-ChildItem -LiteralPath $sourcePath -Recurse -Force -File) } else { @((Get-Item -LiteralPath $sourcePath -Force)) }
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($Source.TrimEnd('\').Length + 1)
            $installedFile = Join-Path $Installed $relative
            if (-not (Test-Path -LiteralPath $installedFile -PathType Leaf)) { return $false }
            $installedInfo = Get-Item -LiteralPath $installedFile -Force
            if (($installedInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $installedInfo.Length -ne $file.Length) { return $false }
            if ((Get-PackageFileDigest $file.FullName) -ne (Get-PackageFileDigest $installedFile)) { return $false }
        }
    }
    try {
        $installedMcp = Get-Content -LiteralPath (Join-Path $Installed 'mcp.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $expectedMcp = Get-Content -LiteralPath (Join-Path $Source 'mcp.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $actual = $installedMcp.mcpServers.'blend-studio'
        $expected = $expectedMcp.mcpServers.'blend-studio'
        return $actual.type -eq $expected.type -and $actual.command -eq 'node' -and $actual.cwd -eq $expected.cwd -and
            (($actual.args | ConvertTo-Json -Compress) -eq ($expected.args | ConvertTo-Json -Compress)) -and
            $actual.env.PATH.StartsWith((Split-Path -Parent $NodeExecutable) + ';', [StringComparison]::OrdinalIgnoreCase) -and
            $actual.env.BLENDER_PATH -eq $expected.env.BLENDER_PATH
    } catch { return $false }
}

function Install-BlendStudio($Requirements) {
    $manifest = Get-Content -LiteralPath (Join-Path $script:taskSource 'plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'blend-studio' -or $manifest.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Blend Studioの配布ファイルを確認できません。ZIPを展開し直してください。' }
    $target = [IO.Path]::GetFullPath((Join-Path $script:taskBase 'plugin'))
    $basePrefix = $script:taskBase.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $target.StartsWith($basePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'インストール先を確認できません。' }
    if ($target.StartsWith($script:taskSource.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'インストール先は配布フォルダーの外に指定してください。' }
    # Only copy packaged files; no dependency directories or user data.
    $items = @('plugin.json', 'mcp.json', 'package.json', 'package-lock.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
        'Install-Blend-Studio.cmd', 'Install-Blend-Studio.ps1', 'Start-Preview.ps1', '.agents', '.codex-plugin', 'docs', 'skills', 'server', 'src', 'dist', 'scripts', 'assets')
    foreach ($name in $items) {
        $path = Join-Path $script:taskSource $name
        if (-not (Test-Path -LiteralPath $path)) { throw ('配布ファイルが不足しています: ' + $name + '。ZIP全体を展開してください。') }
        $entries = @((Get-Item -LiteralPath $path -Force))
        if (Test-Path -LiteralPath $path -PathType Container) { $entries += @(Get-ChildItem -LiteralPath $path -Recurse -Force) }
        if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) { throw '配布フォルダーにリンクが含まれています。元のZIPを展開し直してください。' }
    }
    if (Test-Path -LiteralPath $target) {
        $entries = @((Get-Item -LiteralPath $target -Force)) + @(Get-ChildItem -LiteralPath $target -Recurse -Force)
        if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) { throw 'インストール先にリンクがあるためコピーを中止しました。' }
        $oldPath = Join-Path $target 'plugin.json'
        if (-not (Test-Path -LiteralPath $oldPath -PathType Leaf)) { throw 'インストール先に別のファイルがあります。Blend Studio用の空の場所を指定してください。' }
        $oldManifest = Get-Content -LiteralPath $oldPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($oldManifest.name -ne 'blend-studio') { throw 'インストール先が別のプラグインのためコピーを中止しました。' }
    }
    Write-Step 'Blend StudioをこのPCにコピーしています…'
    [IO.Directory]::CreateDirectory($target) | Out-Null
    if (-not $target.Equals($script:taskSource, [StringComparison]::OrdinalIgnoreCase)) {
        foreach ($name in $items) { Copy-Item -LiteralPath (Join-Path $script:taskSource $name) -Destination $target -Recurse -Force }
    }
    $settingsPath = Join-Path $target 'mcp.json'
    $settings = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    # Agent Plugins permits bare executable names or contained ./ paths.
    # Put Node's folder on this server's PATH instead of an absolute command.
    $settings.mcpServers.'blend-studio'.command = 'node'
    $serverEnvironment = @{ PATH = (Split-Path -Parent $Requirements.Node.Path) + ';' + $env:PATH }
    if ($Requirements.Blender) {
        $serverEnvironment.BLENDER_PATH = $Requirements.Blender
    }
    $settings.mcpServers.'blend-studio' | Add-Member -MemberType NoteProperty -Name env -Value $serverEnvironment -Force
    [IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    if ($ConfigurationHome) { [IO.Directory]::CreateDirectory($ConfigurationHome) | Out-Null }
    Write-Step 'プラグインの一覧に登録しています…'
    $marketplaces = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'marketplace', 'list', '--json')) 'カタログの確認'
    $oldCatalog = @($marketplaces.marketplaces | Where-Object { $_.name -eq 'blend-studio-local' }) | Select-Object -First 1
    $previousRoot = $null
    if ($oldCatalog -and -not ([IO.Path]::GetFullPath($oldCatalog.root)).Equals($target, [StringComparison]::OrdinalIgnoreCase)) {
        $previousRoot = $oldCatalog.root
        $previousCatalogPath = Join-Path $previousRoot '.agents\plugins\marketplace.json'
        if (-not (Test-Path -LiteralPath $previousCatalogPath -PathType Leaf)) { throw '以前のBlend Studioの登録先が見つかりません。デスクトップのプラグイン一覧で古いカタログを削除してから、もう一度お試しください。' }
        $previousCatalog = Get-Content -LiteralPath $previousCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($previousCatalog.name -ne 'blend-studio-local' -or @($previousCatalog.plugins).Count -ne 1 -or $previousCatalog.plugins[0].name -ne 'blend-studio') {
            throw '同名のカタログに別のプラグインが含まれています。既存の登録を確認してください。'
        }
        Write-Step '以前のBlend Studioの登録先を更新しています…'
        $null = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'marketplace', 'remove', 'blend-studio-local', '--json')) '以前の登録先の更新'
    }
    try {
        $catalog = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'marketplace', 'add', $target, '--json')) 'カタログ登録'
    } catch {
        $registrationError = $_.Exception.Message
        if ($previousRoot) {
            $restore = Invoke-Program $Requirements.Codex.Path @('plugin', 'marketplace', 'add', $previousRoot, '--json')
            if ($restore.ExitCode -ne 0) { $registrationError += "`r`n以前の登録先への復元も完了できませんでした。" }
        }
        throw $registrationError
    }
    if ($catalog.marketplaceName -ne 'blend-studio-local') { throw 'カタログの登録結果を確認できませんでした。' }
    $before = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'list', '--json')) '既存のインストール確認'
    $current = @($before.installed | Where-Object { $_.pluginId -eq 'blend-studio@blend-studio-local' -and $_.installed -and $_.enabled }) | Select-Object -First 1
    $cachePath = Get-InstalledCachePath $manifest.version
    $reusedInstallation = $current -and $current.version -eq $manifest.version -and (Test-InstalledPackage $target $cachePath $items $Requirements.Node.Path)
    if ($reusedInstallation) {
        Write-Step '同じ版が正常にインストールされています。動作を確認しています…'
        $installed = [PSCustomObject]@{ pluginId = $current.pluginId; installedPath = $cachePath }
    } else {
        Write-Step 'Blend Studioをインストールしています…'
        try {
            $installed = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'add', 'blend-studio@blend-studio-local', '--json')) 'プラグインのインストール'
        } catch {
            if ($_.Exception.Message -match 'failed to back up plugin cache entry') {
                throw ("使用中のBlend Studioを置き換えられませんでした。`r`nChatGPT／Codexを完全に終了し、ほかのBlend Studioのインストーラーとプレビュー画面を閉じてから、このインストーラーで「もう一度試す」を押してください。`r`n" + $_.Exception.Message)
            }
            throw
        }
    }
    Write-Step '登録結果を確認しています…'
    $listing = Read-ProgramJson (Invoke-Program $Requirements.Codex.Path @('plugin', 'list', '--json')) 'インストール結果の確認'
    $entry = @($listing.installed | Where-Object { $_.name -eq 'blend-studio' -and $_.marketplaceName -eq 'blend-studio-local' }) | Select-Object -First 1
    if (-not $entry -or -not $entry.installed -or -not $entry.enabled) { throw '登録は行いましたが、有効化を確認できませんでした。デスクトップのプラグイン一覧でBlend Studioを有効にしてください。' }
    $installedPath = $installed.installedPath
    if (-not $installedPath -or -not (Test-Path -LiteralPath (Join-Path $installedPath 'server\index.bundle.mjs'))) { throw 'インストール後のファイルを確認できませんでした。' }
    $installedManifest = Get-Content -LiteralPath (Join-Path $installedPath 'plugin.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $installedSettings = Get-Content -LiteralPath (Join-Path $installedPath 'mcp.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($installedManifest.version -ne $manifest.version -or $installedSettings.mcpServers.'blend-studio'.command -ne 'node' -or
        -not $installedSettings.mcpServers.'blend-studio'.env.PATH.StartsWith((Split-Path -Parent $Requirements.Node.Path) + ';', [StringComparison]::OrdinalIgnoreCase)) {
        throw '別の版が登録されています。デスクトップのプラグイン一覧からBlend Studioを更新してください。'
    }
    Write-Step 'アプリから画面と設定を読み込めるか確認しています…'
    $hostCheck = Read-ProgramJson (Invoke-Program $Requirements.Node.Path @((Join-Path $target 'scripts\verify-host.mjs'), $Requirements.Codex.Path) 60) 'アプリへの接続確認'
    if (-not $hostCheck.connected) { throw 'アプリへの接続を確認できませんでした。' }
    $script:taskResult = [PSCustomObject]@{
        success = $true; version = $manifest.version; pluginId = $installed.pluginId;
        installedPath = $installedPath; sourcePath = $target; nodePath = $Requirements.Node.Path;
        codexPath = $Requirements.Codex.Path; blenderAvailable = [bool]$Requirements.Blender; hostVerified = $true; reusedInstallation = [bool]$reusedInstallation;
        marketplacePath = (Join-Path $target '.agents\plugins\marketplace.json')
    }
    [IO.File]::WriteAllText((Join-Path $script:taskBase 'installation.json'), ($script:taskResult | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Write-Step 'インストールが完了しました。デスクトップアプリを再起動してください。'
    return $script:taskResult
}

if ($Headless -or $Console) {
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    try {
        if ($script:taskConsole) {
            [IO.Directory]::CreateDirectory($script:taskBase) | Out-Null
            $script:taskLogPath = Join-Path $script:taskBase 'installer.log'
            [IO.File]::WriteAllText($script:taskLogPath, "Blend Studio installer`r`n", [Text.UTF8Encoding]::new($false))
            Write-Step '必要なソフトと設定を確認しています…'
        }
        $requirements = Get-Requirements
        $result = Install-BlendStudio $requirements
        if ($Headless) { $result | ConvertTo-Json -Depth 8 }
        else {
            Write-Step ('完了：Blend Studio ' + $result.version)
            Write-Step 'ChatGPT／Codexを完全に終了して起動し直し、Blend Studioを開いてください。'
            Write-Step 'Blenderの設定は、Blend Studio画面の「設定」から変更できます。'
        }
        exit 0
    } catch {
        if ($script:taskLogPath) {
            try { [IO.File]::AppendAllText($script:taskLogPath, $_.Exception.Message + "`r`n", [Text.UTF8Encoding]::new($false)) } catch {}
        }
        [Console]::Error.WriteLine($_.Exception.Message)
        if ($script:taskConsole -and $script:taskLogPath) { [Console]::Error.WriteLine('確認用のログ：' + $script:taskLogPath) }
        exit 1
    }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form = [Windows.Forms.Form]::new()
$form.Text = 'Blend Studio インストール'
$form.ClientSize = [Drawing.Size]::new(600, 490)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [Drawing.Color]::FromArgb(25, 22, 36)
$form.ForeColor = [Drawing.Color]::FromArgb(238, 232, 255)
$form.Font = [Drawing.Font]::new('Yu Gothic UI', 10)

function New-Label([string]$Text, [int]$X, [int]$Y, [int]$Width, [int]$Height, [int]$Size = 10) {
    $label = [Windows.Forms.Label]::new()
    $label.Text = $Text
    $label.Location = [Drawing.Point]::new($X, $Y)
    $label.Size = [Drawing.Size]::new($Width, $Height)
    $label.Font = [Drawing.Font]::new('Yu Gothic UI', $Size)
    $form.Controls.Add($label)
    return $label
}
$null = New-Label 'Blend Studio' 30 24 540 46 25
$subtitle = New-Label '3Dモデルを開いて、ChatGPTに修正を相談' 32 77 536 28 12
$subtitle.ForeColor = [Drawing.Color]::FromArgb(186, 167, 245)
$null = New-Label "このPCへのコピーとプラグイン登録を自動で行います。`r`nコマンド入力は不要です。" 32 125 536 55
$requirementsLabel = New-Label '準備を確認しています…' 32 193 536 86
$status = New-Label '確認中' 32 288 536 55
$log = [Windows.Forms.TextBox]::new()
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = 'Vertical'
$log.Location = [Drawing.Point]::new(32, 350)
$log.Size = [Drawing.Size]::new(536, 67)
$log.BackColor = [Drawing.Color]::FromArgb(36, 31, 49)
$log.ForeColor = $form.ForeColor
$log.BorderStyle = 'FixedSingle'
$form.Controls.Add($log)
$button = [Windows.Forms.Button]::new()
$button.Text = 'インストール'
$button.Location = [Drawing.Point]::new(330, 433)
$button.Size = [Drawing.Size]::new(238, 40)
$button.BackColor = [Drawing.Color]::FromArgb(142, 107, 224)
$button.ForeColor = [Drawing.Color]::White
$button.FlatStyle = 'Flat'
$button.FlatAppearance.BorderSize = 0
$button.Enabled = $false
$form.Controls.Add($button)
$support = [Windows.Forms.Button]::new()
$support.Text = '必要なソフトを開く'
$support.Location = [Drawing.Point]::new(32, 433)
$support.Size = [Drawing.Size]::new(215, 40)
$support.FlatStyle = 'Flat'
$support.BackColor = [Drawing.Color]::FromArgb(42, 35, 58)
$support.ForeColor = $form.ForeColor
$form.Controls.Add($support)
$blenderButton = [Windows.Forms.Button]::new()
$blenderButton.Text = 'Blenderを設定…'
$blenderButton.Location = [Drawing.Point]::new(380, 236)
$blenderButton.Size = [Drawing.Size]::new(188, 33)
$blenderButton.FlatStyle = 'Flat'
$blenderButton.BackColor = [Drawing.Color]::FromArgb(42, 35, 58)
$blenderButton.ForeColor = $form.ForeColor
$blenderButton.Enabled = $false
$form.Controls.Add($blenderButton)
$blenderButton.BringToFront()
$script:taskUi = @{ Form = $form; Status = $status; Log = $log; Requirements = $requirementsLabel; Button = $button; Support = $support }
$script:taskRequirements = $null
$script:taskHelpUrl = 'https://nodejs.org/en/download'
$support.Add_Click({ Start-Process $script:taskHelpUrl })
$blenderButton.Add_Click({
    $dialog = [Windows.Forms.OpenFileDialog]::new()
    $dialog.Title = 'Blenderの実行ファイルを選択（後から変更できます）'
    $dialog.Filter = 'Blender (blender.exe)|blender.exe'
    $dialog.CheckFileExists = $true
    try {
        if ($dialog.ShowDialog($form) -eq [Windows.Forms.DialogResult]::OK) {
            $script:taskBusy = $true
            $blenderButton.Enabled = $false
            $configuration = Read-ProgramJson (Invoke-Program $script:taskRequirements.Node.Path @((Join-Path $script:taskSource 'scripts\configure-blender.mjs'), $dialog.FileName) 45) 'Blender設定'
            $script:taskRequirements.Blender = $configuration.blenderPath
            $requirementsLabel.Text = "Node.js：検出済み`r`nCodex：検出済み`r`nBlender：設定済み"
            Write-Step 'Blenderの設定を保存しました。画面の「設定」からも変更できます。'
        }
    } catch { Write-Step $_.Exception.Message }
    finally { $script:taskBusy = $false; $blenderButton.Enabled = $true; $dialog.Dispose() }
})
$button.Add_Click({
    if ($script:taskResult) {
        $uri = 'codex://plugins/blend-studio?marketplacePath=' + [Uri]::EscapeDataString($script:taskResult.marketplacePath)
        try { Start-Process $uri }
        catch { Write-Step 'デスクトップアプリを開き、プラグイン一覧でBlend Studioを選んでください。' }
        return
    }
    $script:taskBusy = $true
    $button.Enabled = $false
    $support.Enabled = $false
    try {
        $null = Install-BlendStudio $script:taskRequirements
        $requirementsLabel.Text = "登録済み：Blend Studio $($script:taskResult.version)`r`nChatGPT／Codexのデスクトップアプリを再起動し、`r`nプラグイン一覧からBlend Studioを開いてください。"
        $button.Text = 'アプリで確認'
        $button.Enabled = $true
    } catch {
        Write-Step 'インストールを完了できませんでした。下の内容を確認してください。'
        $script:taskMessages.Add($_.Exception.Message)
        $log.Text = $script:taskMessages -join "`r`n"
        $log.Height = 110
        $form.ClientSize = [Drawing.Size]::new(600, 535)
        $button.Top = 478
        $support.Top = 478
        $button.Text = 'もう一度試す'
        $button.Enabled = $true
        $support.Enabled = $true
    } finally { $script:taskBusy = $false }
})
$form.Add_FormClosing({ param($sender, $event) if ($script:taskBusy) { $event.Cancel = $true } })
$form.Add_Shown({
    if ($PreviewImage) { return }
    try {
        $script:taskRequirements = Get-Requirements
        $blenderButton.Enabled = $true
        $blenderText = if ($script:taskRequirements.Blender) { 'Blender：検出済み（Blend変換に対応）' } else { 'Blender：未検出（GLB／VRMは利用可能）' }
        $requirementsLabel.Text = "Node.js：検出済み`r`nCodex：検出済み`r`n$blenderText"
        if (-not $script:taskRequirements.Blender) {
            $script:taskHelpUrl = 'https://www.blender.org/download/'
            $support.Text = 'Blenderを入手'
        } else {
            $script:taskHelpUrl = 'https://developers.openai.com/plugins/build/extensions'
            $support.Text = '使い方を見る'
        }
        Write-Step '準備ができました。管理者権限は不要です。'
        $button.Enabled = $true
    } catch {
        $requirementsLabel.Text = '必要なソフトを確認してください。'
        if ($_.Exception.Message -match 'Codex') {
            $script:taskHelpUrl = 'https://learn.chatgpt.com/docs/quickstart'
            $support.Text = 'アプリの導入方法を見る'
        }
        Write-Step $_.Exception.Message
    }
})
if ($PreviewImage) {
    $requirementsLabel.Text = "Node.js：検出済み`r`nCodex：検出済み`r`nBlender：未検出（GLB／VRMは利用可能）"
    $status.Text = '準備ができました。管理者権限は不要です。'
    $log.Text = 'このPCへのコピー → プラグイン登録 → 結果の確認'
    $button.Enabled = $true
    $support.Text = 'Blenderを入手'
    $form.ActiveControl = $button
    $log.SelectionStart = $log.Text.Length
    $log.SelectionLength = 0
    $form.Opacity = 0
    $form.ShowInTaskbar = $false
    $form.Show()
    $form.Refresh()
    [Windows.Forms.Application]::DoEvents()
    $bitmap = [Drawing.Bitmap]::new($form.Width, $form.Height)
    try { $form.DrawToBitmap($bitmap, [Drawing.Rectangle]::new(0, 0, $form.Width, $form.Height)); $bitmap.Save([IO.Path]::GetFullPath($PreviewImage), [Drawing.Imaging.ImageFormat]::Png) }
    finally { $bitmap.Dispose(); $form.Dispose() }
} else { $null = $form.ShowDialog(); $form.Dispose() }
