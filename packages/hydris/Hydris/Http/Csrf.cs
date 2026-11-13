using System.Buffers.Text;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace Hydris.Http;

public sealed class Csrf(Request request, CookieAuthority authority) : ICsrf {
    internal const string CookieName = "hydris_csrf";
    internal const string HeaderName = "X-Hydris-Csrf";

    internal static bool Enabled { get; private set; }
    internal static bool Secure { get; private set; } = true;
    internal static bool AllowSameSite { get; private set; }
    internal static bool OriginOnly { get; private set; }

    internal static void Configure(bool secure, bool allowSameSite, bool originOnly) {
        Secure = secure;
        AllowSameSite = allowSameSite;
        OriginOnly = originOnly;
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
        if (HasTrustedOrigin())
            return true;
        if (OriginOnly)
            return false;

        var cookie = authority.Get(CookieName);
        var submitted = request.Header(HeaderName);
        return cookie is not null &&
               submitted is not null &&
               CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(cookie),
                   Encoding.UTF8.GetBytes(submitted));
    }

    private bool HasTrustedOrigin() {
        var site = request.Header("Sec-Fetch-Site");
        if (site == "same-origin")
            return true;
        if (site == "same-site")
            return AllowSameSite;
        if (site is not null)
            return false;

        return OriginMatchesHost();
    }

    private bool OriginMatchesHost() {
        var host = request.Header("Host");
        if (string.IsNullOrEmpty(host))
            return false;

        var source = request.Header("Origin") ?? request.Header("Referer");
        return source is not null &&
               Uri.TryCreate(source, UriKind.Absolute, out var uri) &&
               string.Equals(uri.Authority, host, StringComparison.OrdinalIgnoreCase);
    }
}
