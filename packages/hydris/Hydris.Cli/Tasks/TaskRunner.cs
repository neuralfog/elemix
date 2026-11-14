using System.Collections.Concurrent;
using System.Diagnostics;
using Hydris.Cli.Config;
using Hydris.Cli.Exec;

namespace Hydris.Cli.Tasks;

public static class TaskRunner {
    private static readonly string[] SpinnerFrames =
        ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    public static int Run(LoadedConfig config, string taskName, IReadOnlyDictionary<string, string> cliEnv) {
        if (!config.File.Tasks.ContainsKey(taskName)) {
            Brand.Error($"unknown task '{taskName}'");
            return 1;
        }
        return ExecuteTask(config, taskName, cliEnv, new List<string>());
    }

    private static int ExecuteTask(
        LoadedConfig config,
        string name,
        IReadOnlyDictionary<string, string> cliEnv,
        List<string> stack) {
        if (stack.Contains(name)) {
            Brand.Error($"cyclic task: {string.Join(" -> ", stack)} -> {name}");
            return 1;
        }

        var task = config.File.Tasks[name];

        if (!task.Parallel.IsEmpty)
            return RunParallel(config, task, cliEnv);

        if (task.Run.IsEmpty)
            return 0;

        stack.Add(name);
        try {
            var soleCommand = task.Run.Count == 1 && !config.File.Tasks.ContainsKey(task.Run.Items[0]);
            foreach (var step in task.Run.Items) {
                var code = RunStep(config, task, name, step, soleCommand, cliEnv, stack);
                if (code != 0) {
                    Brand.Error($"'{step}' failed with exit code {code}");
                    return code;
                }
            }
            return 0;
        } finally {
            stack.RemoveAt(stack.Count - 1);
        }
    }

    private static int RunStep(
        LoadedConfig config,
        TaskSpec parent,
        string parentName,
        string step,
        bool soleCommand,
        IReadOnlyDictionary<string, string> cliEnv,
        List<string> stack) {
        if (config.File.Tasks.ContainsKey(step))
            return ExecuteTask(config, step, cliEnv, stack);

        var env = MergeEnv(config, parent, cliEnv);
        var cwd = ResolveCwd(config, parent);
        Brand.Running(soleCommand ? parentName : step);
        var invocation = Shell.Resolve(parent.Shell, step);
        return ProcessRunner.Run(invocation, cwd, env);
    }

    private static int RunParallel(
        LoadedConfig config,
        TaskSpec parent,
        IReadOnlyDictionary<string, string> cliEnv) {
        var members = parent.Parallel.Items;
        var leaves = new Leaf[members.Count];
        for (var i = 0; i < members.Count; i++) {
            if (!TryResolveLeaf(config, parent, members[i], cliEnv, out var leaf, out var error)) {
                Brand.Error(error!);
                return 1;
            }
            leaves[i] = leaf!;
        }

        var queues = new BlockingCollection<string>[members.Count];
        var results = new int[members.Count];
        var elapsed = new long[members.Count];
        var threads = new Thread[members.Count];

        for (var i = 0; i < members.Count; i++) {
            var index = i;
            var leaf = leaves[index];
            if (Brand.ColorEnabled)
                leaf.Env["FORCE_COLOR"] = "1";
            var invocation = Shell.Resolve(leaf.Shell, leaf.Command);
            var queue = new BlockingCollection<string>();
            queues[index] = queue;

            var thread = new Thread(() => {
                var watch = Stopwatch.StartNew();
                var code = ProcessRunner.RunStreaming(invocation, leaf.Cwd, leaf.Env, line => {
                    if (!string.IsNullOrWhiteSpace(line))
                        queue.Add(line);
                }, out var started);
                watch.Stop();
                if (!started) {
                    code = 127;
                    queue.Add($"command not found: {invocation.File}");
                }
                elapsed[index] = watch.ElapsedMilliseconds;
                results[index] = code;
                queue.CompleteAdding();
            });
            thread.Start();
            threads[index] = thread;
        }

        for (var i = 0; i < members.Count; i++) {
            Brand.TaskBlockStart(leaves[i].Label, Collapse(leaves[i].Command));
            var queue = queues[i];
            var hadOutput = false;
            if (Brand.ColorEnabled) {
                var frame = 0;
                string? first = null;
                while (!queue.IsCompleted) {
                    Brand.Spinner(SpinnerFrames[frame++ % SpinnerFrames.Length]);
                    if (queue.TryTake(out first, 80))
                        break;
                }
                Brand.SpinnerClear();
                if (first is not null) {
                    Brand.TaskBlockLine(first);
                    hadOutput = true;
                }
            }
            foreach (var line in queue.GetConsumingEnumerable()) {
                Brand.TaskBlockLine(line);
                hadOutput = true;
            }
            threads[i].Join();
            Brand.TaskBlockEnd(results[i], elapsed[i], hadOutput);
        }

        var failed = 0;
        for (var i = 0; i < results.Length; i++) {
            if (results[i] != 0 && failed == 0)
                failed = results[i];
        }
        return failed;
    }

    private static bool TryResolveLeaf(
        LoadedConfig config,
        TaskSpec parent,
        string element,
        IReadOnlyDictionary<string, string> cliEnv,
        out Leaf? leaf,
        out string? error) {
        leaf = null;
        error = null;

        var label = config.File.Tasks.ContainsKey(element) ? element : FirstToken(element);
        var shell = parent.Shell;
        var cwd = ResolveCwd(config, parent);
        var env = MergeEnv(config, parent, cliEnv);
        var current = element;
        var visited = new HashSet<string>(StringComparer.Ordinal);

        while (config.File.Tasks.TryGetValue(current, out var task)) {
            if (!visited.Add(current)) {
                error = $"cyclic parallel member '{element}'";
                return false;
            }
            if (!task.Parallel.IsEmpty) {
                error = $"parallel member '{element}' is itself a parallel group";
                return false;
            }
            if (task.Run.Count != 1) {
                error = $"parallel member '{element}' is not a single command";
                return false;
            }
            shell = task.Shell;
            cwd = ResolveCwd(config, task);
            env = MergeEnv(config, task, cliEnv);
            current = task.Run.Items[0];
        }

        leaf = new Leaf(label, current, shell, cwd, env);
        return true;
    }

    private static string FirstToken(string command) {
        var trimmed = command.TrimStart();
        var space = trimmed.IndexOf(' ');
        return space < 0 ? trimmed : trimmed[..space];
    }

    private static string Collapse(string command) {
        var parts = command.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return string.Join(" ", parts);
    }

    private static Dictionary<string, string> MergeEnv(
        LoadedConfig config,
        TaskSpec task,
        IReadOnlyDictionary<string, string> cliEnv) {
        var env = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in config.File.Env)
            env[pair.Key] = pair.Value;
        foreach (var pair in task.Env)
            env[pair.Key] = pair.Value;
        foreach (var pair in cliEnv)
            env[pair.Key] = pair.Value;
        return env;
    }

    private static string ResolveCwd(LoadedConfig config, TaskSpec task) {
        if (string.IsNullOrEmpty(task.Cwd))
            return config.RootDir;
        return Path.GetFullPath(Path.Combine(config.RootDir, task.Cwd));
    }

    private sealed record Leaf(string Label, string Command, string? Shell, string Cwd, Dictionary<string, string> Env);
}
