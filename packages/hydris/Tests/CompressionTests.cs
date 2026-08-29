using System.IO.Compression;
using System.Text;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class CompressionTests : IDisposable {
    private readonly string Dir = System.IO.Path.Combine(AppContext.BaseDirectory, "hydris-compression-tests");

    public CompressionTests() {
        Compressor.Reset();
        Directory.CreateDirectory(Dir);
    }

    public void Dispose() {
        Compressor.Reset();
        if (Directory.Exists(Dir))
            Directory.Delete(Dir, true);
    }

    private static Request Request(string? acceptEncoding, Method method = Method.Get) {
        var headers = new HeaderDictionary();
        if (acceptEncoding is not null)
            headers["Accept-Encoding"] = acceptEncoding;
        return new Request(method, "/", new Dictionary<string, string>(), headers);
    }

    private static byte[] BrotliDecode(byte[] data) {
        var buffer = new byte[64 * 1024];
        BrotliDecoder.TryDecompress(data, buffer, out var written);
        return buffer[..written];
    }

    [Fact]
    public void ConfigureThrowsOnceLocked() {
        Compressor.Configure(new CompressionOptions());
        Compressor.Lock();

        Assert.Throws<InvalidOperationException>(() => Compressor.Configure(new CompressionOptions()));
    }

    [Theory]
    [InlineData("text/html; charset=utf-8", true)]
    [InlineData("application/json", true)]
    [InlineData("image/svg+xml", true)]
    [InlineData("application/manifest+json", true)]
    [InlineData("image/png", false)]
    [InlineData("application/octet-stream", false)]
    [InlineData(null, false)]
    public void IsCompressibleClassifiesTypes(string? contentType, bool expected) {
        Assert.Equal(expected, Compressor.IsCompressible(contentType));
    }

    [Fact]
    public void NegotiatePrefersBrotliOnTie() {
        var settings = new CompressionSettings(1024, true, true);

        Assert.Equal(ContentEncoding.Brotli, Compressor.Negotiate("gzip, br", settings));
    }

    [Fact]
    public void NegotiateFallsBackToGzipWhenBrotliDisabled() {
        var settings = new CompressionSettings(1024, false, true);

        Assert.Equal(ContentEncoding.Gzip, Compressor.Negotiate("br, gzip", settings));
    }

    [Fact]
    public void NegotiateHonoursQualityZero() {
        var settings = new CompressionSettings(1024, true, true);

        Assert.Equal(ContentEncoding.Gzip, Compressor.Negotiate("br;q=0, gzip", settings));
    }

    [Fact]
    public void NegotiateReturnsNullWhenNothingAcceptable() {
        var settings = new CompressionSettings(1024, true, true);

        Assert.Null(Compressor.Negotiate("identity", settings));
        Assert.Null(Compressor.Negotiate(null, settings));
    }

    [Fact]
    public void StaticServesPrecompressedSiblingWhenPresent() {
        var path = System.IO.Path.Combine(Dir, "app.css");
        System.IO.File.WriteAllText(path, new string('a', 2048));
        System.IO.File.WriteAllBytes(path + ".br", [1, 2, 3]);
        Compressor.Configure(new CompressionOptions());

        var choice = Compressor.NegotiateStatic(path, "text/css; charset=utf-8", "br");

        Assert.Equal(path + ".br", choice.Path);
        Assert.Equal("br", choice.Encoding);
        Assert.True(choice.Vary);
    }

    [Fact]
    public void StaticFallsBackToIdentityWithVaryWhenNoSibling() {
        var path = System.IO.Path.Combine(Dir, "app.css");
        System.IO.File.WriteAllText(path, new string('a', 2048));
        Compressor.Configure(new CompressionOptions());

        var choice = Compressor.NegotiateStatic(path, "text/css; charset=utf-8", "br");

        Assert.Equal(path, choice.Path);
        Assert.Null(choice.Encoding);
        Assert.True(choice.Vary);
    }

    [Fact]
    public void StaticAddsNoVaryWhenCompressionDisabled() {
        var path = System.IO.Path.Combine(Dir, "app.css");
        System.IO.File.WriteAllText(path, "body{}");

        var choice = Compressor.NegotiateStatic(path, "text/css", "br");

        Assert.Equal(path, choice.Path);
        Assert.Null(choice.Encoding);
        Assert.False(choice.Vary);
    }

    [Fact]
    public void DynamicCompressesLargeHtmlAndRoundTrips() {
        Compressor.Configure(new CompressionOptions());
        var body = new string('x', 4000);
        var reply = Reply.Html(body);

        Compressor.ApplyDynamic(reply, Request("br"));

        Assert.Equal("br", reply.HeaderValue("Content-Encoding"));
        Assert.Contains("Accept-Encoding", reply.HeaderValue("Vary"));
        Assert.True(reply.Content.Length < body.Length);
        Assert.Equal(body, Encoding.UTF8.GetString(BrotliDecode(reply.Content)));
    }

    [Fact]
    public void DynamicSkipsBodiesBelowThreshold() {
        Compressor.Configure(new CompressionOptions());
        var reply = Reply.Html("<p>tiny</p>");

        Compressor.ApplyDynamic(reply, Request("br"));

        Assert.Null(reply.HeaderValue("Content-Encoding"));
        Assert.Contains("Accept-Encoding", reply.HeaderValue("Vary"));
    }

    [Fact]
    public void DynamicSkipsHeadRequests() {
        Compressor.Configure(new CompressionOptions());
        var reply = Reply.Html(new string('x', 4000));

        Compressor.ApplyDynamic(reply, Request("br", Method.Head));

        Assert.Null(reply.HeaderValue("Content-Encoding"));
    }

    [Fact]
    public void DynamicSkipsNonCompressibleBodies() {
        Compressor.Configure(new CompressionOptions());
        var reply = Reply.Binary(new byte[4000]);

        Compressor.ApplyDynamic(reply, Request("br"));

        Assert.Null(reply.HeaderValue("Content-Encoding"));
    }

    [Fact]
    public void DynamicIsInertWhenCompressionDisabled() {
        var reply = Reply.Html(new string('x', 4000));

        Compressor.ApplyDynamic(reply, Request("br"));

        Assert.Null(reply.HeaderValue("Content-Encoding"));
        Assert.Null(reply.HeaderValue("Vary"));
    }
}
