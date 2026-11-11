using Hydris.Cli.Exec;

namespace Hydris.Cli;

public static class BuildCommand {
    public static int Run(string[] args, IReadOnlyDictionary<string, string> env) {
        var cwd = Directory.GetCurrentDirectory();

        var code = ProcessRunner.TryRun(new Invocation("hydris-build", args), cwd, env, out var started);
        if (started)
            return code;

        var dotnetArgs = new List<string>(args.Length + 1) { "hydris-build" };
        dotnetArgs.AddRange(args);
        return ProcessRunner.Run(new Invocation("dotnet", dotnetArgs), cwd, env);
    }
}
