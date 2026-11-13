using System.Buffers.Text;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace Hydris.Http;

public sealed class Csrf(Request request, CookieAuthority authority) : ICsrf {
    private const string DefaultCookieName = "hydris_csrf";
    private const string DefaultHeaderName = "X-Hydris-Csrf";

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
        Debug.Assert(reply is not null);

        var existing = authority.Get(CookieName);
        if (existing is not null)
            return existing;

        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        authority.SetCookie(reply, CookieName, token, new CookieOptions {
            HttpOnly = true,
            Secure = Secure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
        });
        return token;
    }

    public bool Verify() {
        var cookie = authority.Get(CookieName);
        var submitted = request.Header(HeaderName);
        return cookie is not null &&
               submitted is not null &&
               CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(cookie),
                   Encoding.UTF8.GetBytes(submitted));
    }
}
