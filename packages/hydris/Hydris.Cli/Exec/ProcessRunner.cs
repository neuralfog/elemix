using System.ComponentModel;
using System.Diagnostics;

namespace Hydris.Cli.Exec;

public static class ProcessRunner {
    public static int Run(Invocation invocation, string cwd, IReadOnlyDictionary<string, string> env) {
        var code = TryRun(invocation, cwd, env, out var started);
        if (!started)
            Brand.Error($"command not found: {invocation.File}");
        return code;
    }

    public static int TryRun(Invocation invocation, string cwd, IReadOnlyDictionary<string, string> env, out bool started) {
        started = true;
        try {
            using var process = Launch(invocation, cwd, env);
            if (process is null) {
                started = false;
                return 1;
            }
            process.WaitForExit();
            return process.ExitCode;
        } catch (Win32Exception) {
            started = false;
            return 127;
        }
    }

    public static int RunStreaming(
        Invocation invocation,
        string cwd,
        IReadOnlyDictionary<string, string> env,
        Action<string> onLine,
        out bool started) {
        started = true;
        try {
            var info = BuildInfo(invocation, cwd, env);
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            using var process = Process.Start(info);
            if (process is null) {
                started = false;
                return 1;
            }
            process.OutputDataReceived += (_, e) => {
                if (e.Data is not null)
                    onLine(e.Data);
            };
            process.ErrorDataReceived += (_, e) => {
                if (e.Data is not null)
                    onLine(e.Data);
            };
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            process.WaitForExit();
            return process.ExitCode;
        } catch (Win32Exception) {
            started = false;
            return 127;
        }
    }

    public static Process? Start(Invocation invocation, string cwd, IReadOnlyDictionary<string, string> env) {
        try {
            return Launch(invocation, cwd, env);
        } catch (Win32Exception) {
            Brand.Error($"command not found: {invocation.File}");
            return null;
        }
    }

    public static void StopTree(Process? process) {
        if (process is null)
            return;
        try {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
        } catch (InvalidOperationException) {
        } catch (Win32Exception) {
        }
    }

    private static Process? Launch(Invocation invocation, string cwd, IReadOnlyDictionary<string, string> env) =>
        Process.Start(BuildInfo(invocation, cwd, env));

    private static ProcessStartInfo BuildInfo(Invocation invocation, string cwd, IReadOnlyDictionary<string, string> env) {
        var info = new ProcessStartInfo {
            FileName = invocation.File,
            WorkingDirectory = cwd,
            UseShellExecute = false,
        };

        foreach (var arg in invocation.Args)
            info.ArgumentList.Add(arg);

        foreach (var pair in env)
            info.Environment[pair.Key] = pair.Value;

        return info;
    }
}
