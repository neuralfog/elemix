using Hydris.Cli.Builtins;
using Hydris.Cli.Config;
using Hydris.Cli.Env;
using Hydris.Cli.Tasks;

namespace Hydris.Cli;

public static class Dispatcher {
    public static int Run(string[] argv) {
        var env = new Dictionary<string, string>(StringComparer.Ordinal);
        string? command = null;
        var rest = Array.Empty<string>();

        var i = 0;
        while (i < argv.Length) {
            var a = argv[i];
            if (a is "--help" or "-h" or "help") {
                command = "help";
                break;
            }
            if (a is "--version" or "-V" or "version") {
                command = "version";
                break;
            }
            if (a == "--env-file") {
                if (i + 1 >= argv.Length)
                    return Fail("--env-file requires a path");
                foreach (var pair in EnvFile.Parse(argv[i + 1]))
                    env[pair.Key] = pair.Value;
                i += 2;
                continue;
            }
            if (a == "-e") {
                if (i + 1 >= argv.Length)
                    return Fail("-e requires KEY=VALUE");
                foreach (var pair in EnvFile.ParsePair(argv[i + 1]))
                    env[pair.Key] = pair.Value;
                i += 2;
                continue;
            }
            command = a;
            rest = argv[(i + 1)..];
            break;
        }

        if (command is null)
            return List();

        var config = ConfigLoader.Find(Directory.GetCurrentDirectory());

        switch (command) {
            case "help":
                return Help();
            case "version":
                return Version();
            case "list" or "ls":
                return List();
            case "init":
                return Init();
            case "routes":
                return RoutesCommand.Run();
        }

        if (!ShouldRunTask(command, rest.Length, HasTask(config, command))) {
            return command switch {
                "build" => BuildCommand.Run(rest, WithConfigEnv(config, env)),
                "watch" => WatchCommand.Run(rest, WithConfigEnv(config, env)),
                _ => BuiltinCommands.Run(command, rest),
            };
        }

        if (config is null)
            return Fail("no hydris.yml found in this directory or any parent");
        return TaskRunner.Run(config, command, env);
    }

    public static bool ShouldRunTask(string command, int argCount, bool hasTask) {
        if (!IsBuiltinCommand(command))
            return true;
        return hasTask && argCount == 0;
    }

    private static bool IsBuiltinCommand(string command) =>
        command is "build" or "watch" || BuiltinCommands.IsBuiltin(command);

    private static bool HasTask(LoadedConfig? config, string name) =>
        config is not null && config.File.Tasks.ContainsKey(name);

    private static IReadOnlyDictionary<string, string> WithConfigEnv(LoadedConfig? config, IReadOnlyDictionary<string, string> cliEnv) {
        if (config is null)
            return cliEnv;
        var merged = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var pair in config.File.Env)
            merged[pair.Key] = pair.Value;
        foreach (var pair in cliEnv)
            merged[pair.Key] = pair.Value;
        return merged;
    }

    private static int List() {
        Brand.Banner();

        Console.WriteLine("  commands:");
        foreach (var builtin in BuiltinCatalog.All)
            Brand.CommandLine(builtin.Usage, builtin.Description);
        Brand.Blank();

        var config = ConfigLoader.Find(Directory.GetCurrentDirectory());
        if (config is null) {
            Brand.Info("no hydris.yml found in this directory or any parent");
            return 0;
        }
        if (config.File.Tasks.Count == 0) {
            Brand.Info("no tasks defined");
            return 0;
        }

        Console.WriteLine("  tasks:");
        foreach (var (name, task) in config.File.Tasks)
            Brand.TaskLine(name, task.Desc);
        Brand.Blank();
        return 0;
    }

    private static int Init() {
        var path = Path.Combine(Directory.GetCurrentDirectory(), "hydris.yml");
        if (File.Exists(path))
            return Fail("hydris.yml already exists");
        File.WriteAllText(path, Starter);
        Brand.Info($"created {path}");
        return 0;
    }

    private static int Version() {
        var version = typeof(Dispatcher).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
        Console.WriteLine($"hydris {version}");
        return 0;
    }

    private static int Help() {
        Brand.Banner();
        Console.WriteLine("  usage: hydris [options] <task|command> [args]");
        Console.WriteLine();
        Console.WriteLine("  commands:");
        Console.WriteLine($"    {"<task>".PadRight(26)}run a task from hydris.yml");
        foreach (var builtin in BuiltinCatalog.All)
            Brand.CommandLine(builtin.Usage, builtin.Description);
        Console.WriteLine();
        Console.WriteLine("  options:");
        Console.WriteLine("    --env-file <path>  load env vars from a file");
        Console.WriteLine("    -e KEY=VALUE       set an env var");
        Console.WriteLine("    -h, --help         show help");
        Console.WriteLine("    -V, --version      show version");
        Brand.Blank();
        return 0;
    }

    private static int Fail(string message) {
        Brand.Error(message);
        return 1;
    }

    private const string Starter =
        """
        env:
          NODE_ENV: development

        tasks:
          build:
            desc: Build the app
            run: dotnet build

          clean:
            desc: Remove build output
            run: hydris rm -rf bin obj

          ci:
            desc: Full pipeline
            run: [clean, build, "dotnet test"]
        """;
}
