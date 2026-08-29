using System.Text;
using System.Text.Json.Serialization;
using Hydris.Http;

namespace Hydris.Tests;

internal sealed record Point(int X, int Y);

[JsonSerializable(typeof(Point))]
internal partial class TestJson : JsonSerializerContext;

public sealed class ReplyTests {
    [Fact]
    public void TextSetsBodyStatusAndContentType() {
        var reply = Reply.Text("hi");

        Assert.Equal(200, reply.StatusCode);
        Assert.Equal("hi", Encoding.UTF8.GetString(reply.Content));
        Assert.Equal("text/plain; charset=utf-8", reply.HeaderValue("Content-Type"));
    }

    [Fact]
    public void HtmlSetsHtmlContentType() {
        var reply = Reply.Html("<h1>hi</h1>");

        Assert.Equal("<h1>hi</h1>", Encoding.UTF8.GetString(reply.Content));
        Assert.Equal("text/html; charset=utf-8", reply.HeaderValue("Content-Type"));
    }

    [Fact]
    public void JsonSerializesWithTypeInfo() {
        var reply = Reply.Json(new Point(1, 2), TestJson.Default.Point);

        Assert.Equal("""{"X":1,"Y":2}""", Encoding.UTF8.GetString(reply.Content));
        Assert.Equal("application/json; charset=utf-8", reply.HeaderValue("Content-Type"));
    }

    [Fact]
    public void RedirectSetsLocationAndStatus() {
        var reply = Reply.Redirect("/home");

        Assert.Equal(302, reply.StatusCode);
        Assert.Equal("/home", reply.HeaderValue("Location"));
    }

    [Fact]
    public void StatusOverridesTheCode() {
        var reply = Reply.Text("created").Status(201);

        Assert.Equal(201, reply.StatusCode);
    }

    [Fact]
    public void HeaderAddsACustomHeader() {
        var reply = Reply.Text("x").Header("X-Custom", "value");

        Assert.Equal("value", reply.HeaderValue("X-Custom"));
    }

    [Fact]
    public void CookieAddsASetCookie() {
        var reply = Reply.Text("ok").Cookie("session", "abc", new CookieOptions { HttpOnly = true });

        Assert.Contains("session=abc", reply.SetCookies[0]);
        Assert.Contains("HttpOnly", reply.SetCookies[0]);
    }

    [Fact]
    public void ClearCookieExpiresIt() {
        var reply = Reply.Text("ok").ClearCookie("session");

        Assert.Contains("Max-Age=0", reply.SetCookies[0]);
    }
}
