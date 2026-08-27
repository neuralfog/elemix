using System.Text;
using Hydris.Container;
using Hydris.Http;
using Hydris.Routing;

namespace Hydris.Tests;

public sealed class RouterTests {
    private static Reply Ok() => Reply.Text("");

    [Fact]
    public void MatchesARegisteredRoute() {
        var router = new Router();
        router.Get("/hello", Ok);

        Assert.NotNull(router.Match(Method.Get, "/hello"));
    }

    [Fact]
    public void NoMatchForUnknownPath() {
        var router = new Router();

        Assert.Null(router.Match(Method.Get, "/nope"));
    }

    [Fact]
    public void MethodMismatchIsNotAMatchButIsAllowed() {
        var router = new Router();
        router.Post("/hello", Ok);
        router.Put("/hello", Ok);

        Assert.Null(router.Match(Method.Get, "/hello"));
        Assert.Equal([Method.Post, Method.Put], router.AllowedMethods("/hello"));
    }

    [Theory]
    [InlineData(Method.Get)]
    [InlineData(Method.Head)]
    [InlineData(Method.Post)]
    [InlineData(Method.Put)]
    [InlineData(Method.Patch)]
    [InlineData(Method.Delete)]
    [InlineData(Method.Connect)]
    [InlineData(Method.Options)]
    [InlineData(Method.Trace)]
    public void MatchesEveryVerb(Method method) {
        var router = new Router();
        router.Map(method, "/verb", Ok);

        Assert.NotNull(router.Match(method, "/verb"));
    }

    [Fact]
    public void CapturesSingleParam() {
        var router = new Router();
        router.Get("/hello/:id", Ok);

        Assert.Equal("42", router.Match(Method.Get, "/hello/42")!.Param("id"));
    }

    [Fact]
    public void CapturesMultipleParams() {
        var router = new Router();
        router.Get("/u/:user/post/:post", Ok);

        var match = router.Match(Method.Get, "/u/ada/post/7")!;
        Assert.Equal("ada", match.Param("user"));
        Assert.Equal("7", match.Param("post"));
    }

    [Fact]
    public void CapturesAdjacentParams() {
        var router = new Router();
        router.Get("/:year/:month/:day", Ok);

        var match = router.Match(Method.Get, "/2026/07/24")!;
        Assert.Equal("2026", match.Param("year"));
        Assert.Equal("07", match.Param("month"));
        Assert.Equal("24", match.Param("day"));
    }

    [Fact]
    public void CapturesParamsBookendedByStaticSegments() {
        var router = new Router();
        router.Get("/api/:version/users/:id/posts", Ok);

        var match = router.Match(Method.Get, "/api/v2/users/99/posts")!;
        Assert.Equal("v2", match.Param("version"));
        Assert.Equal("99", match.Param("id"));
    }

    [Fact]
    public void DecodesEachParamIndependently() {
        var router = new Router();
        router.Get("/:a/:b", Ok);

        var match = router.Match(Method.Get, "/a%20b/c%2Fd")!;
        Assert.Equal("a b", match.Param("a"));
        Assert.Equal("c/d", match.Param("b"));
    }

    [Fact]
    public void DoesNotMatchWhenSegmentCountDiffers() {
        var router = new Router();
        router.Get("/hello/:id", Ok);

        Assert.Null(router.Match(Method.Get, "/hello"));
        Assert.Null(router.Match(Method.Get, "/hello/1/2"));
    }

    [Fact]
    public void NormalizesTrailingSlash() {
        var router = new Router();
        router.Get("/hello/:id", Ok);

        Assert.Equal("9", router.Match(Method.Get, "/hello/9/")!.Param("id"));
    }

    [Fact]
    public void StaticBeatsParamWhenParamRegisteredFirst() {
        var router = new Router();
        router.Get("/test/:id", Ok);
        router.Get("/test/new", Ok);

        Assert.Equal("/test/new", router.Match(Method.Get, "/test/new")!.Path);
    }

    [Fact]
    public void StaticBeatsParamWhenParamRegisteredLast() {
        var router = new Router();
        router.Get("/test/new", Ok);
        router.Get("/test/:id", Ok);

        Assert.Equal("/test/new", router.Match(Method.Get, "/test/new")!.Path);
    }

    [Fact]
    public void FallsThroughToParamForOtherValues() {
        var router = new Router();
        router.Get("/test/:id", Ok);
        router.Get("/test/new", Ok);

        var match = router.Match(Method.Get, "/test/42")!;
        Assert.Equal("/test/:id", match.Path);
        Assert.Equal("42", match.Param("id"));
    }

    [Fact]
    public async Task FirstDefinedWinsOnStaticCollision() {
        var router = new Router();
        router.Get("/test/new", () => Reply.Text("first"));
        router.Get("/test/new", () => Reply.Text("second"));

        var match = router.Match(Method.Get, "/test/new")!;
        var reply = await match.Handler(new DiContainer());
        Assert.Equal("first", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public void FirstDefinedWinsOnParamCollision() {
        var router = new Router();
        router.Get("/test/:id", Ok);
        router.Get("/test/:slug", Ok);

        Assert.Equal("/test/:id", router.Match(Method.Get, "/test/42")!.Path);
    }

    [Fact]
    public void WildcardCapturesRemainingSegments() {
        var router = new Router();
        router.Get("/files/*", Ok);

        Assert.Equal("a/b/c", router.Match(Method.Get, "/files/a/b/c")!.Param("*"));
    }

    [Fact]
    public void WildcardDecodesEachSegment() {
        var router = new Router();
        router.Get("/files/*", Ok);

        Assert.Equal("a b/c", router.Match(Method.Get, "/files/a%20b/c")!.Param("*"));
    }

    [Fact]
    public void BacktracksFromStaticToParamWhenDeeperStaticFails() {
        var router = new Router();
        router.Get("/a/b/d", Ok);
        router.Get("/a/:id/c", Ok);

        Assert.Equal("/a/:id/c", router.Match(Method.Get, "/a/b/c")!.Path);
        Assert.Equal("/a/b/d", router.Match(Method.Get, "/a/b/d")!.Path);
    }

    [Fact]
    public void CountReflectsRegistrations() {
        var router = new Router();
        router.Get("/a", Ok);
        router.Get("/b", Ok);

        Assert.Equal(2, router.Count);
    }
}
