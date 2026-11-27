$ErrorActionPreference = 'Stop'
$scriptTarget = Join-Path $PSScriptRoot 'launch.vbs'
if (-not (Test-Path -LiteralPath $scriptTarget)) { throw 'Classmate launcher is missing.' }
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Corthex-Classmate.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
  $backup = Join-Path $desktop ('Classmate 이전 바로가기 ' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.lnk')
  Copy-Item -LiteralPath $shortcutPath -Destination $backup
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + $scriptTarget + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'Classmate · GPT Terra High / Claude Sonnet 5 · 문장 아래에서 함께 공부'
$shortcut.Save()
Write-Output 'Classmate shortcut installed; previous shortcut preserved.'
