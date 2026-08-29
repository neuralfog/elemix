namespace Hydris.Http;

public sealed record CompressionOptions {
    public int? Threshold { get; init; }
    public bool? Brotli { get; init; }
    public bool? Gzip { get; init; }
}
