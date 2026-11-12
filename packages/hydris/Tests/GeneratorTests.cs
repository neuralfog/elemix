using System.Text;
using Hydris.Container;
using Hydris.Core;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class GeneratorTests {
    [Fact]
    public async Task RouteParamBindsToHandlerArgument() {
        var container = new DiContainer().AddServices();
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(Method.Get, "/gen-bind/user/42")!;
        var request = new Request(Method.Get, match.Path, match.Params, new HeaderDictionary());
        await using var scope = CoreServiceProvider.RequestScope(container, request);
        var reply = await match.Handler(scope);

        Assert.Contains("\"value\":\"42\"", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public async Task QueryParamsBindWithConversion() {
        var container = new DiContainer().AddServices();
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(Method.Get, "/gen-bind/search")!;
        var request = new Request(Method.Get, match.Path, match.Params, new HeaderDictionary()) {
            Query = "?q=hi&page=7",
        };
        await using var scope = CoreServiceProvider.RequestScope(container, request);
        var reply = await match.Handler(scope);

        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"value\":\"hi\"", json);
        Assert.Contains("\"number\":7", json);
    }

    [Fact]
    public async Task ActionResultCarriesStatusAndHeaders() {
        var container = new DiContainer().AddServices();
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(Method.Post, "/gen-bind/make")!;
        var request = new Request(Method.Post, match.Path, match.Params, new HeaderDictionary());
        await using var scope = CoreServiceProvider.RequestScope(container, request);
        var reply = await match.Handler(scope);

        Assert.Equal(201, reply.StatusCode);
        Assert.Equal("yes", reply.HeaderValue("X-Made"));
        Assert.Contains("\"value\":\"made\"", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public void QueryValueParsesPairsAndDecodes() {
        var request = new Request(Method.Get, "/x", new Dictionary<string, string>(), new HeaderDictionary()) {
            Query = "?a=1&b=hello+world&c",
        };

        Assert.Equal("1", request.QueryValue("a"));
        Assert.Equal("hello world", request.QueryValue("b"));
        Assert.Equal(string.Empty, request.QueryValue("c"));
        Assert.Null(request.QueryValue("missing"));
    }

    [Fact]
    public void MapsAttributeRoutes() {
        var router = new Router();
        router.MapRoutes();

        Assert.NotNull(router.Match(Method.Get, "/gen"));
    }

    [Fact]
    public void AttributeRouteCarriesUseMiddleware() {
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(Method.Get, "/gen")!;

        Assert.Contains(typeof(GenMw), match.Middlewares);
    }

    [Fact]
    public void JsonAttributeMarksTheRoute() {
        var router = new Router();
        router.MapRoutes();

        Assert.True(router.Match(Method.Get, "/gen/api")!.Json);
        Assert.False(router.Match(Method.Get, "/gen")!.Json);
    }

    [Fact]
    public async Task AttributeRouteResolvesTheController() {
        var container = new DiContainer().AddServices();
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(Method.Get, "/gen")!;
        var reply = await match.Handler(container.Scope());

        Assert.Equal("gen", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public void AutoWiresConstructorDependencies() {
        var container = new DiContainer().AddServices();

        var repo = container.Scope().Get<GenRepo>();

        Assert.Equal("log", repo.Db.Logger.Tag);
    }

    [Fact]
    public void SharesSingletonInstancesAcrossTheGraph() {
        var container = new DiContainer().AddServices();

        var repo = container.Scope().Get<GenRepo>();

        Assert.Same(container.Get<GenDb>(), repo.Db);
        Assert.Same(container.Get<GenLogger>(), repo.Db.Logger);
    }

    [Fact]
    public void HandlerAttributeRegistersAsScoped() {
        var container = new DiContainer().AddServices();

        var first = container.Scope();
        var second = container.Scope();
        var handler = first.Get<GenHandler>();

        Assert.Same(handler, first.Get<GenHandler>());
        Assert.NotSame(handler, second.Get<GenHandler>());
        Assert.Same(container.Get<GenDb>(), handler.Db);
    }

    [Fact]
    public void HonoursDeclaredLifetimes() {
        var container = new DiContainer().AddServices();

        Assert.Same(container.Get<GenDb>(), container.Get<GenDb>());
        Assert.NotSame(container.Get<GenJob>(), container.Get<GenJob>());
    }
}
