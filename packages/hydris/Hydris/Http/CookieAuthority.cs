using System.Buffers.Text;
using System.Collections.Frozen;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Hydris.Http;

public sealed class CookieAuthority(Request request) {
    private static byte[]? SecretBytes;

    private const string NoSecret =
        "CookieAuthority: no cookie signing secret configured. Set one with CookieAuthority.Secret(value) before signing or reading signed cookies.";

    private const string StorePrefix = "store.";
    private const int StoreMaxBytes = 4096;

    private static readonly FrozenSet<string> UnsafeKeys =
        new[] { "__proto__", "constructor", "prototype" }.ToFrozenSet(StringComparer.Ordinal);

    public static void Secret(string value) =>
        SecretBytes = string.IsNullOrEmpty(value) ? null : Encoding.UTF8.GetBytes(value);

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

    public string Stores() {
        var seed = new JsonObject();
        foreach (var (name, value) in request.Cookies) {
            if (!name.StartsWith(StorePrefix, StringComparison.Ordinal))
                continue;
            var key = name[StorePrefix.Length..];
            if (UnsafeKeys.Contains(key) || value.Length > StoreMaxBytes)
                continue;

            JsonNode? parsed;
            try {
                parsed = JsonNode.Parse(value);
            } catch (JsonException) {
                continue;
            }

            if (parsed is not JsonObject entry)
                continue;
            Sanitize(entry);
            seed[key] = entry;
        }

        return seed.ToJsonString();
    }

    private static void Sanitize(JsonObject node) {
        foreach (var key in UnsafeKeys) {
            if (node.ContainsKey(key))
                node.Remove(key);
        }
        foreach (var (_, child) in node) {
            if (child is JsonObject nested)
                Sanitize(nested);
        }
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

        var hash = HMACSHA256.HashData(RequireSecret(), buffer);
        return Base64Url.EncodeToString(hash);
    }

    private static byte[] RequireSecret() =>
        SecretBytes ?? throw new InvalidOperationException(NoSecret);

    private static bool Equal(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}
