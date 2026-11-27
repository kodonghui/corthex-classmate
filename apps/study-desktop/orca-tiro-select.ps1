$ErrorActionPreference = 'Stop'

try {
    if ([Console]::IsInputRedirected) {
        $url = [Console]::ReadLine()
    } else {
        $secret = Read-Host 'Paste the active Tiro share URL' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        try { $url = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secret.Dispose() }
    }
    if ($url -cnotmatch '\Ahttps://tiro\.ooo/s/[A-Za-z0-9_-]{8,100}\z') {
        [Console]::Error.WriteLine('Use the exact HTTPS Tiro share URL. No configuration was changed.')
        exit 2
    }

    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClassmateTiroSelection {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool MoveFileEx(string from, string to, int flags);
}
'@
    $folder = Join-Path $env:LOCALAPPDATA 'CorthexClassmate'
    $null = [IO.Directory]::CreateDirectory($folder)
    $path = Join-Path $folder 'orca-context-tiro.json'
    $temp = Join-Path $folder ('orca-context-tiro-' + [guid]::NewGuid().ToString() + '.tmp')
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $acl = [Security.AccessControl.FileSecurity]::new()
        $acl.SetAccessRuleProtection($true, $false)
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity.User, 'FullControl', 'Allow'))
        $access = [Security.AccessControl.FileSystemRights]::Write
        $stream = [IO.FileStream]::new($temp, 'CreateNew', $access, 'None', 4096, 'WriteThrough', $acl)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Compress -InputObject @{shareUrl=$url}))
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush($true)
        } finally { $stream.Dispose() }
        # Same-directory replacement preserves the new file's private ACL.
        if (![ClassmateTiroSelection]::MoveFileEx($temp, $path, 9)) { throw 'Replacement failed' }
    } finally {
        $identity.Dispose()
        if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) }
    }
    [Console]::WriteLine('Classmate Tiro selection saved locally.')
} catch {
    [Console]::Error.WriteLine('Could not save the private Classmate Tiro selection.')
    exit 1
}
