param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$ThreadId
)
$ErrorActionPreference = 'Stop'
# Only opens one existing local Codex conversation. No prompt, secrets or shell commands in the URL.
# Verified against this installed desktop app's registered codex protocol and threads route.
$studyDesktop = [Environment]::GetFolderPath('Desktop')
$studyName = -join ([char[]](0x43,0x6c,0x61,0x73,0x73,0x6d,0x61,0x74,0x65,0x20,0xacf5,0xbd80,0x20,0xc2dc,0xc791))
$studyLink = Join-Path $studyDesktop ($studyName + '.lnk')
if (Test-Path -LiteralPath $studyLink) {
    Copy-Item -LiteralPath $studyLink -Destination ($studyLink + '.' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '.bak')
}
$studyShell = New-Object -ComObject WScript.Shell
$studyShortcut = $studyShell.CreateShortcut($studyLink)
$studyShortcut.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
$studyShortcut.Arguments = '"codex://threads/' + $ThreadId + '"'
$studyShortcut.Description = 'Open your Classmate study conversation. No project folder selection.'
$studyPackage = Get-AppxPackage OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1
if ($studyPackage) {
    $studyIcon = Join-Path $studyPackage.InstallLocation 'app\resources\icon-chatgpt.ico'
    if (Test-Path -LiteralPath $studyIcon) { $studyShortcut.IconLocation = $studyIcon }
}
$studyShortcut.Save()
$studyCheck = $studyShell.CreateShortcut($studyLink)
if ($studyCheck.Arguments -ne ('"codex://threads/' + $ThreadId + '"')) { throw 'Shortcut verification failed.' }
Write-Output 'Study shortcut created and target verified.'
