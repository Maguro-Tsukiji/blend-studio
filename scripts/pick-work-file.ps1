Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Blend Studio - Working file'
$dialog.Filter = '3D models (*.blend;*.glb;*.vrm)|*.blend;*.glb;*.vrm|All files (*.*)|*.*'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
try {
    if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) {
        @{ cancelled = $false; path = $dialog.FileName } | ConvertTo-Json -Compress
    } else {
        @{ cancelled = $true } | ConvertTo-Json -Compress
    }
} finally { $dialog.Dispose() }
