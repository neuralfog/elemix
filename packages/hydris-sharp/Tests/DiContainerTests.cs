using Hydris.Container;

namespace Hydris.Tests;

public sealed class DiContainerTests {
    private sealed record Config(string Url);

    private interface IMailer {
        string Send();
    }

    private sealed class SmtpMailer : IMailer {
        public string Send() => "sent";
    }

    private sealed class Counter {
        public int Built { get; private set; }

        public object Build() {
            Built++;
            return new object();
        }
    }

    [Fact]
    public void ValueBindingReturnsExactInstance() {
        var container = new DiContainer();
        var config = new Config("x");
        container.Value(config);

        Assert.Same(config, container.Get<Config>());
    }

    [Fact]
    public void SingletonIsLazyAndCached() {
        var container = new DiContainer();
        var built = 0;
        container.Singleton(_ => new Config($"n{++built}"));

        Assert.Equal(0, built);
        var first = container.Get<Config>();
        Assert.Equal(1, built);
        var second = container.Get<Config>();
        Assert.Equal(1, built);
        Assert.Same(first, second);
    }

    [Fact]
    public void StartEagerlyBuildsSingletonsOnce() {
        var container = new DiContainer();
        var singletons = 0;
        var transients = 0;
        container.Singleton(_ => new Config($"s{++singletons}"));
        container.Transient(_ => new SmtpMailer());
        container.Transient(_ => {
            transients++;
            return new object();
        });

        Assert.Equal(0, singletons);
        container.Start();
        Assert.Equal(1, singletons);
        Assert.Equal(0, transients);

        container.Get<Config>();
        Assert.Equal(1, singletons);
    }

    [Fact]
    public void TransientBuildsNewInstanceEveryResolve() {
        var container = new DiContainer();
        var built = 0;
        container.Transient(_ => {
            built++;
            return new Config("t");
        });

        var first = container.Get<Config>();
        var second = container.Get<Config>();
        Assert.NotSame(first, second);
        Assert.Equal(2, built);
    }

    [Fact]
    public void ScopedCachesPerScopeAndDiffersAcrossScopes() {
        var container = new DiContainer();
        container.Scoped(_ => new Config("r"));

        var first = container.Scope();
        var second = container.Scope();
        var value = first.Get<Config>();
        Assert.Same(value, first.Get<Config>());
        Assert.NotSame(value, second.Get<Config>());
    }

    [Fact]
    public void ScopedThrowsWhenResolvedOnRoot() {
        var container = new DiContainer();
        container.Scoped(_ => new Config("r"));

        Assert.Throws<ScopeRequiredException>(() => container.Get<Config>());
    }

    [Fact]
    public void ScopeResolvesSingletonByDelegatingToRoot() {
        var container = new DiContainer();
        container.Singleton(_ => new Config("db"));

        var scope = container.Scope();
        Assert.Same(container.Get<Config>(), scope.Get<Config>());
    }

    [Fact]
    public void BindsAnImplementationBehindAnInterfaceToken() {
        var container = new DiContainer();
        container.Singleton<IMailer>(_ => new SmtpMailer());

        Assert.Equal("sent", container.Get<IMailer>().Send());
    }

    [Fact]
    public void ThrowsForAnUnboundToken() {
        var container = new DiContainer();

        Assert.Throws<UnboundTokenException>(() => container.Get<IMailer>());
    }

    [Fact]
    public void CircularDependencyThrowsWithChain() {
        var container = new DiContainer();
        container.Singleton(resolver => new CycleA(resolver.Get<CycleB>()));
        container.Singleton(resolver => new CycleB(resolver.Get<CycleA>()));

        var error = Assert.Throws<CircularDependencyException>(() => container.Get<CycleA>());
        Assert.Equal(["CycleA", "CycleB", "CycleA"], error.Chain);
    }

    [Fact]
    public void BreaksACycleThroughAProviderThunk() {
        var container = new DiContainer();
        container.Singleton(resolver => new ThunkA(() => resolver.Get<ThunkB>()));
        container.Singleton(resolver => new ThunkB(resolver.Get<ThunkA>()));

        var a = container.Get<ThunkA>();
        var b = a.B();
        Assert.Same(a, b.A);
    }

    [Fact]
    public async Task DisposesOwnedSingletonsNewestFirst() {
        var container = new DiContainer();
        var order = new List<string>();
        container.Singleton(_ => new Ordered("first", order));
        container.Singleton(_ => new SecondOrdered("second", order));
        container.Get<Ordered>();
        container.Get<SecondOrdered>();

        await container.DisposeAsync();
        Assert.Equal(["second", "first"], order);
    }

    [Fact]
    public async Task DisposesScopedInstancesWhenScopeEnds() {
        var container = new DiContainer();
        var disposed = new List<string>();
        container.Scoped(_ => new Ordered("req", disposed));

        var scope = container.Scope();
        scope.Get<Ordered>();
        await scope.DisposeAsync();
        Assert.Equal(["req"], disposed);
    }

    [Fact]
    public void ResolvesOrdinaryServicesInANoHttpScope() {
        var container = WithHttpContext();
        container.Singleton(_ => new Config("c"));
        container.Singleton(resolver => new Db(resolver.Get<Config>(), null));

        var scope = container.Scope().NoHttp();
        Assert.IsType<Db>(scope.Get<Db>());
        Assert.NotNull(scope.Get<Db>().Config);
    }

    [Fact]
    public void ThrowsWhenAJobDirectlyResolvesARequestToken() {
        var container = WithHttpContext();
        var scope = container.Scope().NoHttp();

        Assert.Throws<ForbiddenDependencyException>(() => scope.Get<Request>());
    }

    [Fact]
    public void ThrowsWithTheFullChainForATransitiveRequestDependency() {
        var container = WithHttpContext();
        container.Scoped(resolver => new AuditContext(resolver.Get<Request>()));
        container.Scoped(resolver => new Db(null, resolver.Get<AuditContext>()));

        var scope = container.Scope().NoHttp();
        var error = Assert.Throws<ForbiddenDependencyException>(() => scope.Get<Db>());
        Assert.Equal("http", error.Context);
        Assert.Equal(["Db", "AuditContext", "Request"], error.Chain);
        Assert.Contains("pass via job args", error.Message);
    }

    [Fact]
    public void StillResolvesRequestTokensInAnOrdinaryHttpScope() {
        var container = WithHttpContext();
        var request = new Request("/x");
        var scope = container.Scope();
        scope.Value(request);

        Assert.Same(request, scope.Get<Request>());
    }

    [Fact]
    public void InheritsTheForbidIntoChildScopes() {
        var container = WithHttpContext();
        var job = container.Scope().NoHttp();
        var child = job.Scope();

        Assert.Throws<ForbiddenDependencyException>(() => child.Get<Request>());
    }

    [Fact]
    public void LeavesUnrelatedContainersUnaffectedWhenNoContextRegistered() {
        var container = new DiContainer();
        var scope = container.Scope().NoHttp();
        scope.Value(new Request("/y"));

        Assert.Equal("/y", scope.Get<Request>().Url);
    }

    private static DiContainer WithHttpContext() {
        var container = new DiContainer();
        container.ContextTokens("http", [typeof(Request)], "no request in a worker; pass via job args");
        return container;
    }

    private sealed record Request(string Url);

    private sealed class AuditContext(Request request) {
        public Request Request { get; } = request;
    }

    private sealed class Db(Config? config, AuditContext? audit) {
        public Config? Config { get; } = config;
        public AuditContext? Audit { get; } = audit;
    }

    private sealed class CycleA(CycleB b) {
        public CycleB B { get; } = b;
    }

    private sealed class CycleB(CycleA a) {
        public CycleA A { get; } = a;
    }

    private sealed class ThunkA(Func<ThunkB> b) {
        public Func<ThunkB> B { get; } = b;
    }

    private sealed class ThunkB(ThunkA a) {
        public ThunkA A { get; } = a;
    }

    private sealed class Ordered(string name, List<string> order) : IDisposable {
        public void Dispose() => order.Add(name);
    }

    private sealed class SecondOrdered(string name, List<string> order) : IDisposable {
        public void Dispose() => order.Add(name);
    }
}
