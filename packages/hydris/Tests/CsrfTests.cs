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
        string? secFetchSite = null,
        string? cookie = null,
        string? headerToken = null,
        string? origin = null,
        string? host = null,
        string? referer = null) {
        var headers = new HeaderDictionary();
        if (secFetchSite is not null)
            headers["Sec-Fetch-Site"] = secFetchSite;
        if (cookie is not null)
            headers["Cookie"] = cookie;
        if (headerToken is not null)
            headers[Csrf.HeaderName] = headerToken;
        if (origin is not null)
            headers["Origin"] = origin;
        if (host is not null)
            headers["Host"] = host;
        if (referer is not null)
            headers["Referer"] = referer;
        var request = new Request(method, "/", new Dictionary<string, string>(), headers);
        return new Csrf(request, new CookieAuthority(request));
    }

    private static string SignedCookie(string token) {
        var request = new Request(Method.Get, "/", new Dictionary<string, string>(), new HeaderDictionary());
        var signed = new CookieAuthority(request).Sign(Csrf.CookieName, token);
        return $"{Csrf.CookieName}={signed}";
    }

    [Fact]
    public void SameOriginFetchPassesWithoutToken() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.True(Make(secFetchSite: "same-origin").Verify());
    }

    [Fact]
    public void CrossSiteWithoutTokenFails() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.False(Make(secFetchSite: "cross-site").Verify());
    }

    [Fact]
    public void SameSiteHonoursTheAllowFlag() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.False(Make(secFetchSite: "same-site").Verify());

        Csrf.Configure(secure: true, allowSameSite: true, originOnly: false);
        Assert.True(Make(secFetchSite: "same-site").Verify());
    }

    [Fact]
    public void MatchingTokenPassesWhenOriginIsUnknown() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        var token = "abc123";
        Assert.True(Make(cookie: SignedCookie(token), headerToken: token).Verify());
    }

    [Fact]
    public void MismatchedTokenFails() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.False(Make(cookie: SignedCookie("abc123"), headerToken: "nope").Verify());
    }

    [Fact]
    public void MissingCookieFails() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.False(Make(headerToken: "abc123").Verify());
    }

    [Fact]
    public void TamperedCookieFails() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        var cookie = $"{Csrf.CookieName}=abc123.deadbeef";
        Assert.False(Make(cookie: cookie, headerToken: "abc123").Verify());
    }

    [Fact]
    public void OriginOnlyIgnoresTokens() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: true);
        var token = "abc123";
        Assert.False(Make(cookie: SignedCookie(token), headerToken: token).Verify());
        Assert.True(Make(secFetchSite: "same-origin").Verify());
    }

    [Fact]
    public void OriginHeaderFallbackMatchesHost() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        var token = "abc123";
        Assert.True(Make(
            cookie: SignedCookie(token),
            headerToken: token,
            origin: "https://app.test",
            host: "app.test").Verify());
    }

    [Fact]
    public void CrossOriginRefererFailsWithoutToken() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        Assert.False(Make(referer: "https://evil.test/x", host: "app.test").Verify());
    }

    [Fact]
    public void IssueMintsTokenAndSignedCookie() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
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
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        var token = "abc123";
        var reply = Reply.Text("ok");
        var issued = Make(Method.Get, cookie: SignedCookie(token)).Issue(reply);

        Assert.Equal(token, issued);
        Assert.Empty(reply.CookieHeaders);
    }

    [Fact]
    public void IssuedTokenVerifiesOnTheNextRequest() {
        Csrf.Configure(secure: true, allowSameSite: false, originOnly: false);
        var reply = Reply.Text("ok");
        var token = Make(Method.Get).Issue(reply);

        Assert.True(Make(cookie: SignedCookie(token), headerToken: token).Verify());
    }
}
