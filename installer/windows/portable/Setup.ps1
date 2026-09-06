param(
  [ValidateSet('Install', 'Validate', 'Diagnose', 'Disconnect')][string]$Mode = 'Install',
  [string]$ClaudePath = '',
  [string]$TestRoot = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function File-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $hash = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
  finally { $hash.Dispose(); $stream.Dispose() }
}

function Child-Path([string]$Root, [string]$Relative) {
  if ($Relative -notmatch '^[a-zA-Z0-9_@./+ -]+$' -or $Relative -match '(^|/)\.\.?(/|$)' -or [IO.Path]::IsPathRooted($Relative)) {
    throw 'Unsafe package path.'
  }
  $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $resolved = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (!$resolved.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside package.' }
  return $resolved
}

function Read-Registration {
  if (Test-Path -LiteralPath $script:RegistryPath) { return (Get-Item -LiteralPath $script:RegistryPath).GetValue('') }
  return $null
}

function Find-Claude {
  if ($ClaudePath) { $candidates = @($ClaudePath) }
  else {
    $command = Get-Command claude.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $candidates = @([Environment]::GetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', 'User'))
    if ($command) { $candidates += $command.Source }
    $candidates += (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.local\bin\claude.exe')
    # Recent npm distributions also contain a native executable. Do not execute the .cmd/.ps1 shim.
    $candidates += (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe')
    $shim = Get-Command claude.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($shim) { $candidates += (Join-Path ([IO.Path]::GetDirectoryName($shim.Source)) 'node_modules\@anthropic-ai\claude-code\bin\claude.exe') }
  }
  foreach ($candidate in $candidates) {
    if ($candidate -and [IO.Path]::IsPathRooted($candidate) -and [IO.Path]::GetFileName($candidate) -ieq 'claude.exe' -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return $null
}

function Notify-Environment {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClassmateEnvironmentNotice {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r);
}
'@
  $noticeResult = [UIntPtr]::Zero
  [void][ClassmateEnvironmentNotice]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 3000, [ref]$noticeResult)
}

try {
  $bundleRoot = $PSScriptRoot
  $release = Get-Content -LiteralPath (Join-Path $bundleRoot 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($release.schema -ne 1 -or $release.version -notmatch '^\d+\.\d+\.\d+$' -or $release.extensionId -notmatch '^[a-p]{32}$' -or $release.bundleId -notmatch '^[0-9a-z.-]+$') { throw 'Invalid release metadata.' }
  $seen = @{}
  foreach ($file in $release.files) {
    if ($seen.ContainsKey($file.path) -or $file.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid checksum entry.' }
    $seen[$file.path] = $true
    $path = Child-Path $bundleRoot $file.path
    if (!(Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('Missing or linked file: ' + $file.path) }
    if ((File-Sha256 $path) -ne $file.sha256) { throw ('Checksum mismatch: ' + $file.path) }
  }
  foreach ($required in @('app/host/classmate-host.exe', 'app/extension/manifest.json', 'Setup.ps1', 'Install.cmd', 'Guide.html')) {
    if (!$seen.ContainsKey($required)) { throw ('Missing required payload: ' + $required) }
  }
  $extension = Get-Content -LiteralPath (Child-Path $bundleRoot 'app/extension/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $hash = [Security.Cryptography.SHA256]::Create()
  try { $keyHash = $hash.ComputeHash([Convert]::FromBase64String($extension.key)) } finally { $hash.Dispose() }
  $keyHex = -join ($keyHash[0..15] | ForEach-Object { $_.ToString('x2') })
  $derivedId = -join ($keyHex.ToCharArray() | ForEach-Object { [char](97 + [Convert]::ToInt32([string]$_, 16)) })
  if ($derivedId -ne $release.extensionId -or $extension.version -ne $release.version) { throw 'Extension identity mismatch.' }
  Write-Host ('Package verified: ' + $release.version + ' / ' + $release.files.Count + ' files') -ForegroundColor Green
  if ($Mode -eq 'Validate') { exit 0 }

  $simulation = $TestRoot -ne ''
  if ($simulation) {
    $installBase = [IO.Path]::GetFullPath($TestRoot)
    if (!(Test-Path -LiteralPath (Join-Path $installBase '.classmate-test-root') -PathType Leaf)) { throw 'Test root marker required.' }
  } else {
    if (![Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { throw 'This beta requires Windows x64.' }
    $installBase = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\CorthexClassmate'
  }
  $target = Child-Path $installBase $release.bundleId
  $manifestPath = Join-Path $target 'com.corthex.classmate.json'
  $statePath = Join-Path $target 'installation-state.json'
  $script:RegistryPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate'
  $registered = if ($simulation) { $null } else { Read-Registration }
  $claude = Find-Claude
  if ($Mode -eq 'Diagnose') {
    Write-Host ('Install folder exists: ' + (Test-Path -LiteralPath $target))
    Write-Host ('Chrome registration points here: ' + ($registered -eq $manifestPath))
    Write-Host ('Claude executable found: ' + [bool]$claude)
    Write-Host 'Authentication and AI replies are NOT tested. No account tokens are read.'
    if (!(Test-Path -LiteralPath $target) -or (!$simulation -and $registered -ne $manifestPath) -or !$claude) { exit 2 }
    exit 0
  }
  if ($Mode -eq 'Disconnect') {
    if ($simulation) { Write-Host 'SIMULATION: no registration or environment changes.'; exit 0 }
    if ($registered -ne $manifestPath -or !(Test-Path -LiteralPath $statePath)) { throw 'This package does not own the current registration. Nothing changed.' }
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    Remove-ItemProperty -LiteralPath $RegistryPath -Name '(default)'
    if ([Environment]::GetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', 'User') -eq $state.claudePath) {
      [Environment]::SetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', $state.previousClaudePath, 'User')
      Notify-Environment
    }
    Write-Host 'Disconnected. Program files and ALL study data remain. Remove the extension in Chrome yourself.'
    exit 0
  }
  if (!$claude) { throw 'Install native Claude Code and sign in with your OWN account first. See Guide.html. Then run Install.cmd again.' }
  if ($registered -and $registered -ne $manifestPath) { throw 'Another Classmate installation is registered. Nothing changed; ask the maintainer to migrate it.' }
  if (Test-Path -LiteralPath $target) { throw 'This version is already present. Use Diagnose.cmd; no files were overwritten.' }
  # Never overwrite a symlink/junction in the install ancestry.
  $ancestor = $installBase
  while ($ancestor) {
    if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked install directory is not supported.' }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  foreach ($file in $release.files) {
    $destination = Child-Path $target $file.path
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
    Copy-Item -LiteralPath (Child-Path $bundleRoot $file.path) -Destination $destination
    if ((File-Sha256 $destination) -ne $file.sha256) { throw 'Installed checksum mismatch.' }
  }
  Copy-Item -LiteralPath (Join-Path $bundleRoot 'release.json') -Destination (Join-Path $target 'release.json')
  $hostManifest = @{ name='com.corthex.classmate'; description='Corthex Classmate local tutor'; path=(Join-Path $target 'app\host\classmate-host.exe'); type='stdio'; allowed_origins=@('chrome-extension://' + $release.extensionId + '/') }
  [IO.File]::WriteAllText($manifestPath, ($hostManifest | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
  if (!$simulation) {
    $previousClaude = [Environment]::GetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', 'User')
    @{ claudePath=$claude; previousClaudePath=$previousClaude } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    try {
      [Environment]::SetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', $claude, 'User')
      New-Item -Path $RegistryPath -Force | Out-Null
      Set-Item -LiteralPath $RegistryPath -Value $manifestPath
    } catch {
      [Environment]::SetEnvironmentVariable('CLASSMATE_CLAUDE_CLI', $previousClaude, 'User')
      throw
    }
    Notify-Environment
  }
  Write-Host ''
  Write-Host $(if ($simulation) { 'SIMULATION PASSED: no registry/environment writes.' } else { 'Installed. Close ALL Chrome windows, then reopen Chrome.' }) -ForegroundColor Green
  Write-Host 'Chrome > chrome://extensions > Developer mode > Load unpacked:'
  Write-Host (Join-Path $target 'app\extension') -ForegroundColor Cyan
  Write-Host 'Use your own Tiro shared page and Claude account. See Guide.html.'
  exit 0
} catch {
  Write-Host ('STOP: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Do not disable antivirus or organization security policy. See Guide.html.'
  exit 1
}
