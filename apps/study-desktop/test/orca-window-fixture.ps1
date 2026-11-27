$ErrorActionPreference = 'Stop'
$WarningPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System.Windows.Forms;
public class ClassmateSyntheticWindow : Form {
    protected override bool ShowWithoutActivation { get { return true; } }
}
'@

$form = New-Object ClassmateSyntheticWindow
$form.Text = 'Classmate synthetic capture test'
$form.Size = New-Object Drawing.Size(360, 240)
$form.BackColor = [Drawing.Color]::DeepSkyBlue
$form.ShowInTaskbar = $false
$form.Add_Shown({
    $process = [Diagnostics.Process]::GetCurrentProcess()
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $titleHash = [Convert]::ToBase64String($hash.ComputeHash([Text.Encoding]::Unicode.GetBytes($form.Text))) }
    finally { $hash.Dispose() }
    [Console]::WriteLine((ConvertTo-Json -Compress @{
        handle=$form.Handle.ToInt64().ToString(); pid=$process.Id; start=$process.StartTime.ToUniversalTime().Ticks.ToString();
        titleHash=$titleHash; selectedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }))
})
[Windows.Forms.Application]::Run($form)
