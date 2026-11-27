using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

static class ClassmateMeetLauncher
{
    static int Main(string[] args)
    {
        const string origin = "chrome-extension://ofochilajnihkbfhffpmnddcbjgeffli";
        if (args.Length < 1 || (args[0] != origin && args[0] != origin + "/")) return 2;
        try
        {
            var paths = File.ReadAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime-paths.txt"));
            if (paths.Length != 2 || !File.Exists(paths[0]) || !File.Exists(paths[1])) return 2;
            var options = new ProcessStartInfo(paths[0], "\"" + paths[1] + "\" \"" + origin + "\"")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using (var process = Process.Start(options))
            {
                var input = process.StandardInput.BaseStream;
                var output = process.StandardOutput.BaseStream;
                var error = process.StandardError.BaseStream;
                Pump(Console.OpenStandardInput(), input, true);
                var outputPump = Pump(output, Console.OpenStandardOutput(), false);
                Pump(error, Stream.Null, false);
                process.WaitForExit();
                outputPump.Join();
                return process.ExitCode;
            }
        }
        catch { return 2; }
    }

    static Thread Pump(Stream from, Stream to, bool closeDestination)
    {
        var thread = new Thread(() =>
        {
            try
            {
                var buffer = new byte[8192];
                int count;
                while ((count = from.Read(buffer, 0, buffer.Length)) != 0)
                {
                    to.Write(buffer, 0, count);
                    to.Flush();
                }
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
            finally { if (closeDestination) to.Close(); }
        }) { IsBackground = true };
        thread.Start();
        return thread;
    }
}
