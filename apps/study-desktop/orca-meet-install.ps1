param([switch]$StageOnly)

$ErrorActionPreference = 'Stop'
$folder = Join-Path $env:LOCALAPPDATA 'CorthexClassmate/orca-meet-host'
$null = [IO.Directory]::CreateDirectory($folder)
$node = (Get-Command node.exe -ErrorAction Stop | Select-Object -First 1).Source
$script = Join-Path $PSScriptRoot 'orca-meet-native.mjs'
$app = Join-Path $folder 'ClassmateMeetHost.exe'
$source = Join-Path $PSScriptRoot 'orca-meet-launcher.cs'
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler not available.' }
& $compiler /nologo /target:exe "/out:$app" $source
if ($LASTEXITCODE -ne 0) { throw 'Could not build the local Meet connector.' }
[IO.File]::WriteAllLines((Join-Path $folder 'runtime-paths.txt'),[string[]]@($node,$script))
$name = 'com.corthex.classmate.meet'
$manifest = Join-Path $folder "$name.json"
$settings = @{name=$name; description='Classmate Orca Meet connector'; path=$app; type='stdio';
    allowed_origins=@('chrome-extension://ofochilajnihkbfhffpmnddcbjgeffli/')}
[IO.File]::WriteAllText($manifest,(ConvertTo-Json -Compress $settings))
if (!$StageOnly) {
    $key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name"
    $null = New-Item -Path $key -Force
    Set-Item -Path $key -Value $manifest
    Write-Output 'Local Meet connector registered for this Windows user.'
} else { Write-Output 'Local Meet connector built; registry untouched.' }
