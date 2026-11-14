using System.IO;
using System.Text;
using Hydris.Container;
using Hydris.Core;
using Hydris.Http;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class GeneratorTests {
    private static async Task<Reply> Dispatch(Method method, string path, string? query = null, string? body = null) {
        var container = new DiContainer().AddServices();
        var router = new Router();
        router.MapRoutes();

        var match = router.Match(method, path)!;
        var request = new Request(method, match.Path, match.Params, new HeaderDictionary());
        if (query is not null)
            request.Query = query;
        if (body is not null)
            request.BodyStream = new MemoryStream(Encoding.UTF8.GetBytes(body));
        await using var scope = CoreServiceProvider.RequestScope(container, request);
        return await match.Handler(scope);
    }

    [Fact]
    public async Task BodyWrongShapeReturns400() {
        var reply = await Dispatch(Method.Post, "/gen-bind/strict", body: "[]");
        Assert.Equal(400, reply.StatusCode);
    }

    [Fact]
    public async Task MalformedBodyReturns400() {
        var reply = await Dispatch(Method.Post, "/gen-bind/strict", body: "{ not json");
        Assert.Equal(400, reply.StatusCode);
    }

    [Fact]
    public async Task TypeConfusedBodyReturns400() {
        var reply = await Dispatch(Method.Post, "/gen-bind/strict", body: "{\"name\":123}");
        Assert.Equal(400, reply.StatusCode);
    }

    [Fact]
    public async Task BodyValidationReturns400WithFieldError() {
        var reply = await Dispatch(Method.Post, "/gen-bind/strict", body: "{}");

        Assert.Equal(400, reply.StatusCode);
        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"field\":\"name\"", json);
        Assert.Contains("\"code\":\"required\"", json);
    }

    [Fact]
    public async Task EndpointBindsContractAndReturnsJson() {
        var reply = await Dispatch(Method.Post, "/gen-bind/endpoint", body: "{\"name\":\"ada\"}");

        Assert.Equal(200, reply.StatusCode);
        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"value\":\"ada\"", json);
        Assert.Contains("\"number\":7", json);
    }

    [Fact]
    public async Task EndpointValidatesContractAndReturns400() {
        var reply = await Dispatch(Method.Post, "/gen-bind/endpoint", body: "{}");

        Assert.Equal(400, reply.StatusCode);
        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"field\":\"name\"", json);
        Assert.Contains("\"code\":\"required\"", json);
    }

    [Fact]
    public async Task MissingRequiredQueryReturns400() {
        var reply = await Dispatch(Method.Get, "/gen-bind/search", query: "?q=hi");

        Assert.Equal(400, reply.StatusCode);
        Assert.Contains("\"field\":\"page\"", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public async Task InvalidQueryScalarReturns400() {
        var reply = await Dispatch(Method.Get, "/gen-bind/search", query: "?page=abc");

        Assert.Equal(400, reply.StatusCode);
        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"field\":\"page\"", json);
        Assert.Contains("\"code\":\"invalid\"", json);
    }

    [Fact]
    public async Task OptionalQueryOmittedBindsFallback() {
        var reply = await Dispatch(Method.Get, "/gen-bind/search", query: "?page=5");

        Assert.Equal(200, reply.StatusCode);
        Assert.Contains("\"value\":\"none\"", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public async Task EnumBoolGuidQueryBind() {
        var id = Guid.NewGuid();
        var reply = await Dispatch(Method.Get, "/gen-bind/paint", query: $"?shade=Dark&on=true&id={id}");

        Assert.Equal(200, reply.StatusCode);
        var json = Encoding.UTF8.GetString(reply.Content);
        Assert.Contains("\"shade\":\"Dark\"", json);
        Assert.Contains("\"on\":true", json);
        Assert.Contains(id.ToString(), json);
    }

    [Fact]
    public async Task InvalidEnumQueryReturns400() {
        var reply = await Dispatch(Method.Get, "/gen-bind/paint", query: $"?shade=Purple&on=true&id={Guid.NewGuid()}");
        Assert.Equal(400, reply.StatusCode);
    }

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
    public async Task ActionReplyCarriesStatusAndHeaders() {
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
