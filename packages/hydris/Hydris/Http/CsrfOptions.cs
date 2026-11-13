namespace Hydris.Http;

public sealed record CsrfOptions {
    public bool Secure { get; init; } = true;
    public bool AllowSameSite { get; init; }
    public bool OriginOnly { get; init; }
}
