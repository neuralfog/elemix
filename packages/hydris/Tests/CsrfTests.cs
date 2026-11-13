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
        var token = "abc123";
        Assert.True(Make(cookie: SignedCookie(token), headerToken: token).Verify());
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
        var token = "abc123";
        var reply = Reply.Text("ok");
        var issued = Make(Method.Get, cookie: SignedCookie(token)).Issue(reply);

        Assert.Equal(token, issued);
        Assert.Empty(reply.CookieHeaders);
    }

    [Fact]
    public void IssuedTokenVerifiesOnTheNextRequest() {
        Csrf.Configure(secure: true);
        var reply = Reply.Text("ok");
        var token = Make(Method.Get).Issue(reply);

        Assert.True(Make(cookie: SignedCookie(token), headerToken: token).Verify());
    }
}
