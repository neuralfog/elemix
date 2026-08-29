using System.Text;
using Hydris.Error;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class DefaultErrorRendererTests {
    private static Request Req(string? accept) {
        var headers = new HeaderDictionary();
        if (accept is not null)
            headers["Accept"] = accept;
        return new Request(Method.Get, "/", new Dictionary<string, string>(), headers);
    }

    private static string Body(Reply reply) => Encoding.UTF8.GetString(reply.Content);

    [Fact]
    public void HttpExceptionKeepsItsStatusAsHtml() {
        var reply = new DefaultErrorRenderer().Render(new NotFoundException(), Req("text/html"), false);

        Assert.Equal(404, reply.StatusCode);
        Assert.Contains("text/html", reply.HeaderValue("Content-Type"));
        Assert.Contains("404", Body(reply));
        Assert.Contains("Not Found", Body(reply));
    }

    [Fact]
    public void RepliesJsonWhenAccepted() {
        var reply = new DefaultErrorRenderer().Render(new BadRequestException("bad input"), Req("application/json"), false);

        Assert.Equal(400, reply.StatusCode);
        Assert.Contains("application/json", reply.HeaderValue("Content-Type"));
        Assert.Equal("{\"error\":\"bad input\",\"status\":400}", Body(reply));
    }

    [Fact]
    public void JsonEndpointRepliesJsonEvenWhenBrowserWantsHtml() {
        var reply = new DefaultErrorRenderer().Render(new NotFoundException(), Req("text/html"), true);

        Assert.Equal(404, reply.StatusCode);
        Assert.Contains("application/json", reply.HeaderValue("Content-Type"));
        Assert.Equal("{\"error\":\"Not Found\",\"status\":404}", Body(reply));
    }

    [Fact]
    public void UnknownExceptionBecomesFiveHundredAndHidesTheMessage() {
        var reply = new DefaultErrorRenderer().Render(new InvalidOperationException("secret detail"), Req(null), false);

        Assert.Equal(500, reply.StatusCode);
        Assert.Contains("Internal Server Error", Body(reply));
        Assert.DoesNotContain("secret detail", Body(reply));
    }

    [Fact]
    public void EscapesTheMessageInHtml() {
        var reply = new DefaultErrorRenderer().Render(new BadRequestException("<script>"), Req("text/html"), false);

        Assert.Contains("&lt;script&gt;", Body(reply));
        Assert.DoesNotContain("<script>", Body(reply));
    }
}
