using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;
using CookieOptions = Hydris.Http.CookieOptions;
using SameSiteMode = Hydris.Http.SameSiteMode;

namespace Hydris.Tests;

public sealed class CookieAuthorityTests {
    private static CookieAuthority AuthWith(string cookieHeader) {
        var headers = new HeaderDictionary();
        if (cookieHeader.Length > 0)
            headers["Cookie"] = cookieHeader;
        var request = new Request(Method.Get, "/", new Dictionary<string, string>(), headers);
        return new CookieAuthority(request);
    }

    [Fact]
    public void ParsesTheCookieHeader() {
        var jar = CookieAuthority.Parse("session=abc; theme=dark");

        Assert.Equal("abc", jar["session"]);
        Assert.Equal("dark", jar["theme"]);
    }

    [Fact]
    public void ParseSkipsMalformedPairs() {
        var jar = CookieAuthority.Parse("a=1; broken; b=2");

        Assert.Equal("1", jar["a"]);
        Assert.Equal("2", jar["b"]);
        Assert.False(jar.ContainsKey("broken"));
    }

    [Fact]
    public void ParseDecodesEncodedValues() {
        Assert.Equal("a b", CookieAuthority.Parse("name=a%20b")["name"]);
    }

    [Fact]
    public void SerializeEncodesValueAndDefaultsPath() {
        Assert.Equal("n=a%20b; Path=/", CookieAuthority.Serialize("n", "a b"));
    }

    [Fact]
    public void SerializeWritesOptions() {
        var cookie = CookieAuthority.Serialize("s", "v", new CookieOptions {
            MaxAge = 3600,
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
        });

        Assert.Contains("s=v", cookie);
        Assert.Contains("Max-Age=3600", cookie);
        Assert.Contains("HttpOnly", cookie);
        Assert.Contains("Secure", cookie);
        Assert.Contains("SameSite=Lax", cookie);
        Assert.Contains("Path=/", cookie);
    }

    [Fact]
    public void SignsThenReadsTheValueBack() {
        CookieAuthority.Secret("unit-secret");
        var signed = AuthWith("").Sign("sid", "abc123");

        Assert.StartsWith("abc123.", signed);
        Assert.Equal("abc123", AuthWith($"sid={signed}").Get("sid"));
    }

    [Fact]
    public void RejectsATamperedValue() {
        CookieAuthority.Secret("unit-secret");
        var signed = AuthWith("").Sign("sid", "abc123");
        var dot = signed.LastIndexOf('.');
        var tampered = "abc124" + signed[dot..];

        Assert.Null(AuthWith($"sid={tampered}").Get("sid"));
    }

    [Fact]
    public void BindsTheSignatureToTheCookieName() {
        CookieAuthority.Secret("unit-secret");
        var signed = AuthWith("").Sign("sid", "abc123");

        Assert.Null(AuthWith($"other={signed}").Get("other"));
    }

    [Fact]
    public void RejectsAValueSignedWithADifferentSecret() {
        CookieAuthority.Secret("secret-a");
        var signed = AuthWith("").Sign("sid", "v");
        CookieAuthority.Secret("secret-b");

        Assert.Null(AuthWith($"sid={signed}").Get("sid"));
    }

    [Fact]
    public void ThrowsWhenSigningWithNoSecret() {
        CookieAuthority.Secret("");

        Assert.Throws<InvalidOperationException>(() => AuthWith("").Sign("sid", "x"));
    }

    [Fact]
    public void ReturnsNullForAMissingCookie() {
        CookieAuthority.Secret("unit-secret");

        Assert.Null(AuthWith("").Get("sid"));
    }
}
