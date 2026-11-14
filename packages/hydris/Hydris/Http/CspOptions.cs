namespace Hydris.Http;

public sealed record CspOptions {
    public string? EnvFile { get; init; }
    public bool? ReportOnly { get; init; }
}
