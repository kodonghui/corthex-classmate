param([Parameter(Mandatory)][ValidateSet('Select','Capture')][string]$Action)

$ErrorActionPreference = 'Stop'
$WarningPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public static class ClassmateWindow {
    public class Choice {
        public string Window { get; set; }
        public string App { get; set; }
        public string Handle { get; set; }
        public int ProcessId { get; set; }
        public string ProcessStart { get; set; }
        public string TitleHash { get; set; }
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int Left, Top, Right, Bottom; }
    delegate bool Visit(IntPtr window, IntPtr arg);
    [DllImport("user32.dll")] static extern bool EnumWindows(Visit visit, IntPtr arg);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder title, int count);
    [DllImport("user32.dll")] static extern int GetWindowTextLengthW(IntPtr window);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr window, IntPtr memoryDc, uint flags);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);

    static Choice Identify(IntPtr window) {
        if (!IsWindowVisible(window) || IsIconic(window)) return null;
        int cloaked;
        if (DwmGetWindowAttribute(window, 14, out cloaked, 4) != 0 || cloaked != 0) return null;
        uint affinity;
        if (GetWindowDisplayAffinity(window, out affinity) && affinity != 0) return null;
        uint pid;
        if (GetWindowThreadProcessId(window, out pid) == 0) return null;
        int length = GetWindowTextLengthW(window);
        if (length < 1 || length > 4096) return null;
        var title = new StringBuilder(length + 1);
        if (GetWindowText(window, title, title.Capacity) != length || GetWindowTextLengthW(window) != length) return null;
        try {
            using (var process = Process.GetProcessById((int)pid))
            using (var sha = SHA256.Create()) {
                return new Choice { Window = title.ToString(), App = process.ProcessName,
                    Handle = window.ToInt64().ToString(), ProcessId = (int)pid,
                    ProcessStart = process.StartTime.ToUniversalTime().Ticks.ToString(),
                    TitleHash = Convert.ToBase64String(sha.ComputeHash(Encoding.Unicode.GetBytes(title.ToString()))) };
            }
        } catch (ArgumentException) { return null; }
          catch (InvalidOperationException) { return null; }
          catch (System.ComponentModel.Win32Exception) { return null; }
    }

    public static Choice[] Choices() {
        var choices = new List<Choice>();
        EnumWindows(delegate(IntPtr window, IntPtr arg) {
            var choice = Identify(window);
            if (choice != null) choices.Add(choice);
            return true;
        }, IntPtr.Zero);
        return choices.ToArray();
    }

    static bool Matches(IntPtr window, int pid, string start, string titleHash) {
        var choice = Identify(window);
        return choice != null && choice.ProcessId == pid && choice.ProcessStart == start && choice.TitleHash == titleHash;
    }

    public static bool IsCurrent(Choice choice) {
        return Matches(new IntPtr(long.Parse(choice.Handle)), choice.ProcessId, choice.ProcessStart, choice.TitleHash);
    }

    public static bool RequiresMeetSelection(Choice choice) {
        return choice != null && String.Equals(choice.App, "chrome", StringComparison.OrdinalIgnoreCase) &&
            Regex.IsMatch(choice.Window, @"^\s*Meet(?:\s|[-\u2013\u2014:]|$)|(?:[-\u2013\u2014])\s*Google Meet(?:\s|$)", RegexOptions.IgnoreCase);
    }

    public static bool IsLegacyMeet(long handle, int pid, string start, string titleHash) {
        var choice = Identify(new IntPtr(handle));
        return choice != null && choice.ProcessId == pid && choice.ProcessStart == start && choice.TitleHash == titleHash &&
            RequiresMeetSelection(choice);
    }

    public static string Capture(long handle, int pid, string start, string titleHash) {
        var window = new IntPtr(handle);
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        if (previous == IntPtr.Zero) return null;
        try {
            Rect rect;
            if (!Matches(window, pid, start, titleHash) || !GetWindowRect(window, out rect)) return null;
            int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
            if (width < 2 || height < 2 || width > 8192 || height > 8192 || (long)width * height > 24000000) return null;
            using (var bitmap = new Bitmap(width, height, PixelFormat.Format24bppRgb)) {
                using (var graphics = Graphics.FromImage(bitmap)) {
                    var dc = graphics.GetHdc();
                    try { if (!PrintWindow(window, dc, 2)) return null; }
                    finally { graphics.ReleaseHdc(dc); }
                }
                Rect after;
                if (!Matches(window, pid, start, titleHash) || !GetWindowRect(window, out after) ||
                    rect.Left != after.Left || rect.Top != after.Top || rect.Right != after.Right || rect.Bottom != after.Bottom) return null;
                double scale = Math.Min(1.0, 1280.0 / Math.Max(width, height));
                using (var image = new Bitmap(bitmap, Math.Max(1, (int)(width * scale)), Math.Max(1, (int)(height * scale)))) {
                    bool visible = false;
                    for (int y = 0; y < image.Height && !visible; y += 11) {
                        for (int x = 0; x < image.Width; x += 11) {
                            var pixel = image.GetPixel(x, y);
                            if (pixel.R > 8 || pixel.G > 8 || pixel.B > 8) { visible = true; break; }
                        }
                    }
                    if (!visible) return null;
                    using (var memory = new MemoryStream()) {
                        image.Save(memory, ImageFormat.Jpeg);
                        if (memory.Length > 900000) return null;
                        return Convert.ToBase64String(memory.ToArray());
                    }
                }
            }
        } finally { SetThreadDpiAwarenessContext(previous); }
    }
}
'@

function Show-ClassmateWindowPicker {
    Add-Type -AssemblyName System.Windows.Forms
    $form = [Windows.Forms.Form]::new()
    try {
        $form.Text = 'Classmate: select one window for requested screenshots (2 hours)'
        $form.Size = [Drawing.Size]::new(800, 480)
        $form.MinimumSize = [Drawing.Size]::new(520, 300)
        $form.StartPosition = 'CenterScreen'

        $list = [Windows.Forms.ListView]::new()
        $list.Dock = 'Fill'
        $list.View = 'Details'
        $list.FullRowSelect = $true
        $list.MultiSelect = $false
        [void]$list.Columns.Add('App', 105)
        [void]$list.Columns.Add('Window', 525)
        [void]$list.Columns.Add('Handle', 90)

        $bar = [Windows.Forms.FlowLayoutPanel]::new()
        $bar.Dock = 'Bottom'
        $bar.AutoSize = $true
        $bar.Padding = [Windows.Forms.Padding]::new(6)
        $choose = [Windows.Forms.Button]::new()
        $choose.Text = 'Select'
        $choose.Enabled = $false
        $refresh = [Windows.Forms.Button]::new()
        $refresh.Text = 'Refresh'
        $cancel = [Windows.Forms.Button]::new()
        $cancel.Text = 'Cancel'
        $cancel.DialogResult = 'Cancel'
        $status = [Windows.Forms.Label]::new()
        $status.AutoSize = $true
        $status.Padding = [Windows.Forms.Padding]::new(8,6,0,0)
        $bar.Controls.AddRange([Windows.Forms.Control[]]@($choose,$refresh,$cancel,$status))
        $form.Controls.Add($list)
        $form.Controls.Add($bar)
        $form.AcceptButton = $choose
        $form.CancelButton = $cancel

        $scan = {
            $list.BeginUpdate()
            try {
                $choose.Enabled = $false
                $list.Items.Clear()
                foreach ($choice in ([ClassmateWindow]::Choices() | Sort-Object App,Window,Handle)) {
                    if ($choice.Handle -eq $form.Handle.ToInt64().ToString()) { continue }
                    $row = [Windows.Forms.ListViewItem]::new($choice.App)
                    [void]$row.SubItems.Add($choice.Window)
                    [void]$row.SubItems.Add($choice.Handle)
                    $row.Tag = $choice
                    [void]$list.Items.Add($row)
                }
                $status.Text = if ($list.Items.Count -eq 0) { 'No eligible windows. Open the window and click Refresh.' } else { '' }
            } finally { $list.EndUpdate() }
        }.GetNewClosure()
        $accept = {
            if ($list.SelectedItems.Count -ne 1) { return }
            $choice = $list.SelectedItems[0].Tag
            if (![ClassmateWindow]::IsCurrent($choice)) {
                & $scan
                $status.Text = 'That window changed. Select it again after refreshing the list.'
                return
            }
            $form.Tag = $choice
            $form.DialogResult = 'OK'
        }.GetNewClosure()

        $list.Add_SelectedIndexChanged({ $choose.Enabled = $list.SelectedItems.Count -eq 1 }.GetNewClosure())
        $list.Add_DoubleClick($accept)
        $choose.Add_Click($accept)
        $refresh.Add_Click($scan)
        $form.Add_Shown($scan)
        if ($form.ShowDialog() -eq 'OK') { return $form.Tag }
    } finally { $form.Dispose() }
}

if ($Action -eq 'Select') {
    $profile = Join-Path $env:LOCALAPPDATA 'CorthexClassmate'
    $path = Join-Path $profile 'orca-context-window.json'
    $target = Show-ClassmateWindowPicker
    if (!$target -or ![ClassmateWindow]::IsCurrent($target)) { return }
    $entry = @{handle=$target.Handle; pid=$target.ProcessId; start=$target.ProcessStart; titleHash=$target.TitleHash; selectedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); selectionId=[guid]::NewGuid().ToString()}
    $needsMeetSelection = [ClassmateWindow]::RequiresMeetSelection($target)
    if ($needsMeetSelection) { $entry['kind'] = 'meet-needs-authorization' }
    $null = [IO.Directory]::CreateDirectory($profile)
    $temp = Join-Path $profile ('orca-context-window-' + $entry.selectionId + '.tmp')
    try {
        [IO.File]::WriteAllText($temp, (ConvertTo-Json -InputObject $entry -Compress))
        # Windows PowerShell converts an untyped $null to an empty backup path.
        if ([IO.File]::Exists($path)) { [IO.File]::Replace($temp, $path, [NullString]::Value) }
        else { [IO.File]::Move($temp, $path) }
    } finally { if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) } }
    if ($needsMeetSelection) {
        [void][Windows.Forms.MessageBox]::Show('To bind this exact Meet tab, click Classmate Orca - Meet on that tab in Chrome.','Classmate Orca')
        return
    }
    Write-Output 'Selected window saved.'
    return
}

try {
    $target = ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())
    if ([ClassmateWindow]::IsLegacyMeet([long]$target.handle,[int]$target.pid,$target.start,$target.titleHash)) { exit 3 }
    $image = [ClassmateWindow]::Capture([long]$target.handle, [int]$target.pid, $target.start, $target.titleHash)
    if ($image) { [Console]::Write($image) }
    else { exit 2 }
} catch { exit 2 }
