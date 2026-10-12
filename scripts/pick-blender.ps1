[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
[Windows.Forms.Application]::EnableVisualStyles()
$dialog = [Windows.Forms.OpenFileDialog]::new()
$dialog.Title = 'Blenderを設定 — blender.exe を選択'
$dialog.Filter = 'Blender (blender.exe)|blender.exe'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$dialog.InitialDirectory = Join-Path $env:ProgramFiles 'Blender Foundation'
try {
    if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) {
        @{ cancelled = $false; path = $dialog.FileName } | ConvertTo-Json -Compress
    } else { @{ cancelled = $true } | ConvertTo-Json -Compress }
} finally { $dialog.Dispose() }
