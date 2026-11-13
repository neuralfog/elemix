namespace Hydris.Http;

public sealed record CsrfOptions {
    public bool Secure { get; init; } = true;
    public string? CookieName { get; init; }
    public string? HeaderName { get; init; }
}
