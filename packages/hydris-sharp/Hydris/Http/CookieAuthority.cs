using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Hydris.Http;

public sealed class CookieAuthority(Request request) {
    private static string? ConfiguredSecret;

    private const string NoSecret =
        "CookieAuthority: no cookie signing secret configured. Set one with CookieAuthority.Secret(value) before signing or reading signed cookies.";

    public static void Secret(string value) => ConfiguredSecret = value;

    public static IReadOnlyDictionary<string, string> Parse(string? header) {
        var jar = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(header))
            return jar;

        foreach (var part in header.Split(';')) {
            var eq = part.IndexOf('=');
            if (eq < 0)
                continue;
            var name = part[..eq].Trim();
            if (name.Length == 0)
                continue;
            jar[name] = Uri.UnescapeDataString(part[(eq + 1)..].Trim());
        }

        return jar;
    }

    public static string Serialize(string name, string value, CookieOptions? options = null) {
        options ??= new CookieOptions();
        var parts = new List<string> { $"{name}={Uri.EscapeDataString(value)}" };

        if (options.MaxAge is int maxAge)
            parts.Add($"Max-Age={maxAge}");
        if (options.Expires is DateTimeOffset expires)
            parts.Add($"Expires={expires.UtcDateTime:R}");
        parts.Add($"Path={options.Path ?? "/"}");
        if (options.Domain is not null)
            parts.Add($"Domain={options.Domain}");
        if (options.Secure)
            parts.Add("Secure");
        if (options.HttpOnly)
            parts.Add("HttpOnly");
        if (options.SameSite is SameSiteMode sameSite)
            parts.Add($"SameSite={sameSite}");

        return string.Join("; ", parts);
    }

    public string Sign(string name, string value) => $"{value}.{Mac(name, value)}";

    public void SetCookie(Reply reply, string name, string value, CookieOptions? options = null) {
        ArgumentNullException.ThrowIfNull(reply);
        reply.Cookie(name, Sign(name, value), options);
    }

    public string? Get(string name) {
        if (!request.Cookies.TryGetValue(name, out var signed))
            return null;
        var dot = signed.LastIndexOf('.');
        if (dot < 0)
            return null;

        var value = signed[..dot];
        return Equal(signed[(dot + 1)..], Mac(name, value)) ? value : null;
    }

    private string Mac(string name, string value) {
        var nameBytes = Encoding.UTF8.GetBytes(name);
        var valueBytes = Encoding.UTF8.GetBytes(value);
        var buffer = new byte[nameBytes.Length + 1 + valueBytes.Length];
        nameBytes.CopyTo(buffer, 0);
        buffer[nameBytes.Length] = 0;
        valueBytes.CopyTo(buffer, nameBytes.Length + 1);

        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(RequireSecret()), buffer);
        return Base64Url.EncodeToString(hash);
    }

    private static string RequireSecret() {
        var secret = ConfiguredSecret;
        if (string.IsNullOrEmpty(secret))
            throw new InvalidOperationException(NoSecret);
        return secret;
    }

    private static bool Equal(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}
