using System.Text;
using Hydris.Container;
using Hydris.Routing;

namespace Hydris.Tests;

public sealed class GeneratorTests {
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
