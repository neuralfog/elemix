namespace Hydris.Cli.Builtins;

public readonly record struct BuiltinInfo(string Usage, string Description);

public static class BuiltinCatalog {
    public static IReadOnlyList<BuiltinInfo> All { get; } = [
        new("build [args]", "run the hydris build"),
        new("watch <glob>... -- <cmd>", "re-run a command when files change"),
        new("routes", "list every route and flag duplicates"),
        new("list, ls", "list tasks from hydris.yml"),
        new("init", "write a starter hydris.yml"),
        new("rm [-rf] <path>...", "remove files or directories"),
        new("cp [-r] <src>... <dst>", "copy files or directories"),
        new("mkdir [-p] <dir>...", "create directories"),
        new("mv <src>... <dst>", "move or rename a file or directory"),
        new("env", "print environment variables"),
    ];
}
