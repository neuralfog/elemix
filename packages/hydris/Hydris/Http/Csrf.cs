using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Hydris.Http;

public sealed class Csrf(Request request, CookieAuthority authority) : ICsrf {
    private const string DefaultCookieName = "hydris_csrf";
    private const string DefaultHeaderName = HeaderNames.XHydrisCsrf;

    internal static bool Enabled { get; private set; }
    internal static bool Secure { get; private set; } = true;
    internal static string CookieName { get; private set; } = DefaultCookieName;
    internal static string HeaderName { get; private set; } = DefaultHeaderName;

    internal static void Configure(
        bool secure,
        string? cookieName = null,
        string? headerName = null
    ) {
        Secure = secure;
        CookieName = cookieName ?? DefaultCookieName;
        HeaderName = headerName ?? DefaultHeaderName;
    }

    internal static void Enable() => Enabled = true;

    public string Issue(Reply reply) {
        ArgumentNullException.ThrowIfNull(reply);

        var existing = authority.Get(CookieName);
        if (existing is not null)
            return Mask(existing);

        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        authority.SetCookie(reply, CookieName, token, new CookieOptions {
            HttpOnly = true,
            Secure = Secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
        });
        return Mask(token);
    }

    public bool Verify() {
        var cookie = authority.Get(CookieName);
        var submitted = request.Header(HeaderName);
        if (cookie is null || submitted is null)
            return false;
        var unmasked = Unmask(submitted);
        return unmasked is not null &&
               CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(cookie),
                   Encoding.UTF8.GetBytes(unmasked));
    }

    private static string Mask(string token) {
        var raw = Encoding.UTF8.GetBytes(token);
        var combined = new byte[raw.Length * 2];
        var nonce = combined.AsSpan(0, raw.Length);
        RandomNumberGenerator.Fill(nonce);
        for (var i = 0; i < raw.Length; i++)
            combined[raw.Length + i] = (byte)(raw[i] ^ nonce[i]);
        return Base64Url.EncodeToString(combined);
    }

    private static string? Unmask(string value) {
        byte[] combined;
        try {
            combined = Base64Url.DecodeFromChars(value);
        } catch (FormatException) {
            return null;
        }
        if (combined.Length == 0 || (combined.Length & 1) != 0)
            return null;
        var half = combined.Length / 2;
        var raw = new byte[half];
        for (var i = 0; i < half; i++)
            raw[i] = (byte)(combined[i] ^ combined[half + i]);
        return Encoding.UTF8.GetString(raw);
    }
}
