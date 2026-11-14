using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

[CollectionDefinition("CookieSecret")]
public sealed class CookieSecretCollection;

[Collection("CookieSecret")]
public sealed class CsrfTests {
    public CsrfTests() => CookieAuthority.Secret(Guid.NewGuid().ToString());

    private static Csrf Make(
        Method method = Method.Post,
        string? cookie = null,
        string? headerToken = null) {
        var headers = new HeaderDictionary();
        if (cookie is not null)
            headers["Cookie"] = cookie;
        if (headerToken is not null)
            headers[Csrf.HeaderName] = headerToken;
        var request = new Request(method, "/", new Dictionary<string, string>(), headers);
        return new Csrf(request, new CookieAuthority(request));
    }

    private static string SignedCookie(string token) {
        var request = new Request(Method.Get, "/", new Dictionary<string, string>(), new HeaderDictionary());
        var signed = new CookieAuthority(request).Sign(Csrf.CookieName, token);
        return $"{Csrf.CookieName}={signed}";
    }

    [Fact]
    public void MatchingTokenPasses() {
        Csrf.Configure(secure: true);
        var cookie = SignedCookie("abc123");
        var masked = Make(Method.Get, cookie: cookie).Issue(Reply.Text("ok"));
        Assert.True(Make(cookie: cookie, headerToken: masked).Verify());
    }

    [Fact]
    public void MismatchedTokenFails() {
        Csrf.Configure(secure: true);
        Assert.False(Make(cookie: SignedCookie("abc123"), headerToken: "nope").Verify());
    }

    [Fact]
    public void MissingHeaderFails() {
        Csrf.Configure(secure: true);
        Assert.False(Make(cookie: SignedCookie("abc123")).Verify());
    }

    [Fact]
    public void MissingCookieFails() {
        Csrf.Configure(secure: true);
        Assert.False(Make(headerToken: "abc123").Verify());
    }

    [Fact]
    public void TamperedCookieFails() {
        Csrf.Configure(secure: true);
        var cookie = $"{Csrf.CookieName}=abc123.deadbeef";
        Assert.False(Make(cookie: cookie, headerToken: "abc123").Verify());
    }

    [Fact]
    public void IssueMintsTokenAndSignedCookie() {
        Csrf.Configure(secure: true);
        var reply = Reply.Text("ok");
        var token = Make(Method.Get).Issue(reply);

        Assert.False(string.IsNullOrEmpty(token));
        Assert.Single(reply.CookieHeaders);
        var header = reply.CookieHeaders[0];
        Assert.StartsWith($"{Csrf.CookieName}=", header);
        Assert.Contains("HttpOnly", header);
        Assert.Contains("Secure", header);
        Assert.Contains("SameSite=Lax", header);
    }

    [Fact]
    public void IssueReusesAnExistingValidCookie() {
        Csrf.Configure(secure: true);
        var cookie = SignedCookie("abc123");
        var reply = Reply.Text("ok");
        var issued = Make(Method.Get, cookie: cookie).Issue(reply);

        Assert.Empty(reply.CookieHeaders);
        Assert.True(Make(cookie: cookie, headerToken: issued).Verify());
    }

    [Fact]
    public void IssuedTokenVerifiesOnTheNextRequest() {
        Csrf.Configure(secure: true);
        var reply = Reply.Text("ok");
        var masked = Make(Method.Get).Issue(reply);
        var cookiePair = reply.CookieHeaders[0].Split(';')[0];

        Assert.True(Make(cookie: cookiePair, headerToken: masked).Verify());
    }

    [Fact]
    public void IssuedTokenIsMaskedPerResponseYetVerifies() {
        Csrf.Configure(secure: true);
        var cookie = SignedCookie("session-secret-token");

        var a = Make(Method.Get, cookie: cookie).Issue(Reply.Text("ok"));
        var b = Make(Method.Get, cookie: cookie).Issue(Reply.Text("ok"));

        Assert.NotEqual(a, b);
        Assert.True(Make(cookie: cookie, headerToken: a).Verify());
        Assert.True(Make(cookie: cookie, headerToken: b).Verify());
    }

    [Fact]
    public void UnsetNamesFallBackToDefaults() {
        Csrf.Configure(secure: true);
        Assert.Equal("hydris_csrf", Csrf.CookieName);
        Assert.Equal("X-Hydris-Csrf", Csrf.HeaderName);
    }

    [Fact]
    public void ConfiguredCookieAndHeaderNamesAreUsed() {
        Csrf.Configure(secure: true, cookieName: "my_csrf", headerName: "X-My-Csrf");
        try {
            Assert.Equal("my_csrf", Csrf.CookieName);
            Assert.Equal("X-My-Csrf", Csrf.HeaderName);

            var reply = Reply.Text("ok");
            var masked = Make(Method.Get).Issue(reply);
            var cookiePair = reply.CookieHeaders[0].Split(';')[0];
            Assert.StartsWith("my_csrf=", cookiePair);

            Assert.True(Make(cookie: cookiePair, headerToken: masked).Verify());

            var stale = new HeaderDictionary {
                ["Cookie"] = cookiePair,
                ["X-Hydris-Csrf"] = masked,
            };
            var request = new Request(Method.Post, "/", new Dictionary<string, string>(), stale);
            Assert.False(new Csrf(request, new CookieAuthority(request)).Verify());
        } finally {
            Csrf.Configure(secure: true);
        }
    }
}
