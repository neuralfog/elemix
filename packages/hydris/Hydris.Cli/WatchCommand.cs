using Hydris.Cli.Exec;

namespace Hydris.Cli;

public static class WatchCommand {
    private static readonly string[] Excluded = ["bin", "obj", "node_modules", ".git"];

    public static int Run(string[] args, IReadOnlyDictionary<string, string> env) {
        var sep = Array.IndexOf(args, "--");
        string[] patterns;
        string[] cmd;
        if (sep >= 0) {
            patterns = args[..sep];
            cmd = args[(sep + 1)..];
        } else if (args.Length >= 2) {
            patterns = [args[0]];
            cmd = args[1..];
        } else {
            patterns = [];
            cmd = [];
        }

        if (patterns.Length == 0 || cmd.Length == 0) {
            Brand.Error("usage: hydris watch <path|glob>... -- <command> [args...]");
            return 1;
        }

        var globs = new List<Glob>();
        foreach (var p in patterns)
            globs.Add(Glob.Compile(p));

        var cwd = Directory.GetCurrentDirectory();
        var baseDirs = globs
            .Select(g => Path.GetFullPath(g.BaseDir))
            .Where(Directory.Exists)
            .Distinct()
            .ToList();

        if (baseDirs.Count == 0) {
            Brand.Error("watch: no existing directories to watch");
            return 1;
        }

        var invocation = new Invocation(cmd[0], cmd[1..]);
        var signal = new AutoResetEvent(false);

        var current = ProcessRunner.Start(invocation, cwd, env);
        if (current is null)
            return 127;

        Console.CancelKeyPress += (_, _) => ProcessRunner.StopTree(current);

        void OnChange(string fullPath) {
            var rel = Path.GetRelativePath(cwd, fullPath).Replace('\\', '/');
            if (IsExcluded(rel))
                return;
            foreach (var g in globs) {
                if (g.IsMatch(rel)) {
                    signal.Set();
                    return;
                }
            }
        }

        var watchers = new List<FileSystemWatcher>();
        foreach (var baseDir in baseDirs) {
            var w = new FileSystemWatcher(baseDir) {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName,
            };
            w.Changed += (_, e) => OnChange(e.FullPath);
            w.Created += (_, e) => OnChange(e.FullPath);
            w.Deleted += (_, e) => OnChange(e.FullPath);
            w.Renamed += (_, e) => OnChange(e.FullPath);
            w.EnableRaisingEvents = true;
            watchers.Add(w);
        }

        Brand.Info($"watching {string.Join(", ", patterns)}");

        while (true) {
            signal.WaitOne();
            Thread.Sleep(200);
            signal.Reset();
            Brand.Info("change detected");
            ProcessRunner.StopTree(current);
            current = ProcessRunner.Start(invocation, cwd, env);
            if (current is null)
                return 127;
        }
    }

    private static bool IsExcluded(string relativePath) {
        foreach (var segment in relativePath.Split('/')) {
            if (Array.IndexOf(Excluded, segment) >= 0)
                return true;
        }
        return false;
    }
}
