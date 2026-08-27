namespace Hydris.Http;

public enum SameSiteMode {
    Strict,
    Lax,
    None,
}

public sealed record CookieOptions {
    public int? MaxAge { get; init; }
    public DateTimeOffset? Expires { get; init; }
    public string? Path { get; init; }
    public string? Domain { get; init; }
    public bool Secure { get; init; }
    public bool HttpOnly { get; init; }
    public SameSiteMode? SameSite { get; init; }
}
