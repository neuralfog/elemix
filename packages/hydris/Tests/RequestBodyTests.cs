using System.Text;
using Hydris.Error;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class RequestBodyTests {
    private static Request Make(byte[]? body, long? contentLength) {
        var headers = new HeaderDictionary();
        if (contentLength is not null)
            headers.ContentLength = contentLength;
        var request = new Request(Method.Post, "/x", new Dictionary<string, string>(), headers);
        if (body is not null)
            request.BodyStream = new MemoryStream(body);
        return request;
    }

    [Fact]
    public async Task ExactReadWithContentLengthReturnsBody() {
        var body = Encoding.UTF8.GetBytes("{\"name\":\"Ada\"}");
        var read = await Make(body, body.Length).ReadBodyAsync();
        Assert.Equal(body, read);
    }

    [Fact]
    public async Task ChunkedBodyWithoutContentLengthReadsFully() {
        var body = Encoding.UTF8.GetBytes("{\"name\":\"Ada\"}");
        var read = await Make(body, null).ReadBodyAsync();
        Assert.Equal(body, read);
    }

    [Fact]
    public async Task BodyExactlyAtCapIsAllowed() {
        var body = new byte[Request.DefaultMaxBodyBytes];
        var read = await Make(body, body.Length).ReadBodyAsync();
        Assert.Equal(Request.DefaultMaxBodyBytes, read.Length);
    }

    [Fact]
    public async Task DeclaredContentLengthOverCapThrows413() {
        var request = Make([], Request.DefaultMaxBodyBytes + 1);
        var error = await Assert.ThrowsAsync<PayloadTooLargeException>(
            async () => await request.ReadBodyAsync());
        Assert.Equal(413, error.Status);
    }

    [Fact]
    public async Task ChunkedBodyOverCapThrows413() {
        var request = Make(new byte[Request.DefaultMaxBodyBytes + 1], null);
        await Assert.ThrowsAsync<PayloadTooLargeException>(
            async () => await request.ReadBodyAsync());
    }

    [Fact]
    public async Task ConfiguredLimitIsEnforced() {
        var request = Make([], 2048);
        request.MaxBodyBytes = 1024;
        await Assert.ThrowsAsync<PayloadTooLargeException>(
            async () => await request.ReadBodyAsync());
    }

    [Fact]
    public async Task EmptyBodyReturnsEmpty() {
        Assert.Empty(await Make(null, null).ReadBodyAsync());
        Assert.Empty(await Make([], 0).ReadBodyAsync());
    }
}
