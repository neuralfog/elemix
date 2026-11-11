namespace Hydris.Cli.Config;

public sealed class HydrisFile {
    public Dictionary<string, string> Env { get; set; } = new();
    public Dictionary<string, TaskSpec> Tasks { get; set; } = new();
}

public sealed class TaskSpec {
    public string? Desc { get; set; }
    public CommandList Run { get; set; } = new();
    public string? Shell { get; set; }
    public string? Cwd { get; set; }
    public CommandList Parallel { get; set; } = new();
    public Dictionary<string, string> Env { get; set; } = new();
}

public sealed class LoadedConfig {
    public required HydrisFile File { get; init; }
    public required string Path { get; init; }
    public required string RootDir { get; init; }
}
