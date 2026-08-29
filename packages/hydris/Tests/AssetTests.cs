using Hydris.Error;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class AssetTests : IDisposable {
    private readonly string Dir = System.IO.Path.Combine(AppContext.BaseDirectory, "hydris-asset-tests");

    public AssetTests() => Directory.CreateDirectory(Dir);

    public void Dispose() {
        if (Directory.Exists(Dir))
            Directory.Delete(Dir, true);
    }

    private AssetConfig Make(string name, string body = "x", AssetOptions? options = null) {
        System.IO.File.WriteAllText(System.IO.Path.Combine(Dir, name), body);
        return new AssetConfig("hydris-asset-tests", options ?? new AssetOptions());
    }

    private static Request Get(string wildcard, HeaderDictionary? headers = null) =>
        new(Method.Get, "/assets", new Dictionary<string, string> { ["*"] = wildcard }, headers ?? []);

    [Fact]
    public void ServesFileWithMimeAndDefaultNoCache() {
        var config = Make("app.css", "body{}");

        var reply = AssetHandler.Serve(Get("app.css"), config);

        Assert.Equal(200, reply.StatusCode);
        Assert.Equal("text/css; charset=utf-8", reply.HeaderValue("Content-Type"));
        Assert.Equal("no-cache", reply.HeaderValue("Cache-Control"));
        Assert.NotNull(reply.HeaderValue("ETag"));
        Assert.EndsWith("app.css", reply.SourcePath!);
    }

    [Fact]
    public void ResolvesNestedSubdirectories() {
        Directory.CreateDirectory(System.IO.Path.Combine(Dir, "img"));
        var config = Make(System.IO.Path.Combine("img", "logo.svg"));

        var reply = AssetHandler.Serve(Get("img/logo.svg"), config);

        Assert.Equal("image/svg+xml", reply.HeaderValue("Content-Type"));
        Assert.EndsWith(System.IO.Path.Combine("img", "logo.svg"), reply.SourcePath!);
    }

    [Fact]
    public void ImmutableBuildsLongLivedCacheControl() {
        var config = Make("home-abc123.js", options: new AssetOptions { Immutable = true });

        var reply = AssetHandler.Serve(Get("home-abc123.js"), config);

        Assert.Equal("public, max-age=31536000, immutable", reply.HeaderValue("Cache-Control"));
    }

    [Fact]
    public void MaxAgeWithoutImmutableIsPlainPublic() {
        var config = Make("banner.png", options: new AssetOptions { MaxAge = 3600 });

        var reply = AssetHandler.Serve(Get("banner.png"), config);

        Assert.Equal("public, max-age=3600", reply.HeaderValue("Cache-Control"));
    }

    [Fact]
    public void RepeatingTheEtagYieldsNotModified() {
        var config = Make("app.css");
        var etag = AssetHandler.Serve(Get("app.css"), config).HeaderValue("ETag")!;

        var reply = AssetHandler.Serve(
            Get("app.css", new HeaderDictionary { ["If-None-Match"] = etag }),
            config);

        Assert.Equal(304, reply.StatusCode);
        Assert.Equal(etag, reply.HeaderValue("ETag"));
        Assert.Equal("no-cache", reply.HeaderValue("Cache-Control"));
    }

    [Fact]
    public void ElemixServesHashedJsAsImmutable() {
        var config = Make("home-a1b2c3.js", "export{}", new AssetOptions { Immutable = true });

        var reply = AssetHandler.ServeElemix(Get("home-a1b2c3.js"), config);

        Assert.Equal(200, reply.StatusCode);
        Assert.Equal("text/javascript; charset=utf-8", reply.HeaderValue("Content-Type"));
        Assert.Equal("public, max-age=31536000, immutable", reply.HeaderValue("Cache-Control"));
    }

    [Theory]
    [InlineData("styles.css")]
    [InlineData("home-a1b2c3.js.map")]
    [InlineData("nested/app.js")]
    [InlineData("../secret.js")]
    public void ElemixRejectsAnythingButFlatJs(string wildcard) {
        var config = Make("home-a1b2c3.js", options: new AssetOptions { Immutable = true });

        Assert.Throws<NotFoundException>(() => AssetHandler.ServeElemix(Get(wildcard), config));
    }

    [Fact]
    public void MissingFileIsNotFound() {
        var config = Make("app.css");

        Assert.Throws<NotFoundException>(() => AssetHandler.Serve(Get("gone.css"), config));
    }

    [Fact]
    public void EmptyWildcardIsNotFound() {
        var config = Make("app.css");

        Assert.Throws<NotFoundException>(() => AssetHandler.Serve(Get(""), config));
    }

    [Theory]
    [InlineData("../secret.txt")]
    [InlineData("../../etc/passwd")]
    [InlineData("sub/../../escape.txt")]
    public void PathTraversalIsRejected(string wildcard) {
        System.IO.File.WriteAllText(
            System.IO.Path.Combine(Dir, "..", "secret.txt"), "leak");
        var config = Make("app.css");

        try {
            Assert.Throws<NotFoundException>(() => AssetHandler.Serve(Get(wildcard), config));
        } finally {
            var leaked = System.IO.Path.Combine(Dir, "..", "secret.txt");
            if (System.IO.File.Exists(leaked))
                System.IO.File.Delete(leaked);
        }
    }
}
