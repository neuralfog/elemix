namespace Hydris.Http;

public sealed record AssetOptions {
    public int? MaxAge { get; init; }
    public bool Immutable { get; init; }
}
