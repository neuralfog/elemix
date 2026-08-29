using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using Hydris.Cli;
using Hydris.Container;
using Hydris.Core;
using Hydris.Error;
using Hydris.Http;
using Hydris.Middleware;
using Hydris.Renderer;
using Hydris.Routing;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.Server.Kestrel.Transport.Sockets;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hydris;

public sealed class App {
    public Router Routes { get; } = new();
    public DiContainer Container { get; } = new();
    public bool TrustProxy { get; set; }

    private readonly List<Type> Middlewares = [];
    private IErrorRenderer Errors = new DefaultErrorRenderer();

    public App() {
        new CoreServiceProvider().Register(Container);
        Bootstrap.ApplyServices(Container);
        Bootstrap.ApplyRoutes(Routes);

        var elemix = new AssetConfig("public/_elemix", new AssetOptions { Immutable = true });
        Routes.Get<Request>("/_elemix/*", request => AssetHandler.ServeElemix(request, elemix));
    }

    public App Middleware<T>() where T : IMiddleware {
        Middlewares.Add(typeof(T));
        return this;
    }

    public App Compression(CompressionOptions? options = null) {
        Compressor.Configure(options ?? new CompressionOptions());
        return this;
    }

    public App Assets(string prefix, string dir, AssetOptions? options = null) {
        ArgumentException.ThrowIfNullOrEmpty(prefix);
        ArgumentException.ThrowIfNullOrEmpty(dir);

        var config = new AssetConfig(dir, options ?? new AssetOptions());
        var trimmed = prefix.Trim('/');
        var route = trimmed.Length == 0 ? "/*" : $"/{trimmed}/*";
        Routes.Get<Request>(route, request => AssetHandler.Serve(request, config));
        return this;
    }

    public App RenderErrors(IErrorRenderer renderer) {
        ArgumentNullException.ThrowIfNull(renderer);
        Errors = renderer;
        return this;
    }

    public async Task Serve(int port = 5000) {
        var stopwatch = Stopwatch.StartNew();

        Container.Start();

        using var loggerFactory = LoggerFactory.Create(builder =>
            builder.AddSimpleConsole(o => o.SingleLine = true).SetMinimumLevel(LogLevel.Warning));

        if (Container.Has<IRenderer>())
            Views.UseRenderer(Container.Get<IRenderer>());
        Views.UseManifest(Container.Get<ElemixManifest>());
        Compressor.Lock();

        var kestrel = new KestrelServerOptions();
        kestrel.Listen(BindAddress(), port);

        var transport = new SocketTransportFactory(
            Options.Create(new SocketTransportOptions()),
            loggerFactory);

        using var server = new KestrelServer(Options.Create(kestrel), transport, loggerFactory);

        await server.StartAsync(new Dispatcher(Routes, Container, TrustProxy, Middlewares, Errors), CancellationToken.None);

        Console.Write(Banner.Serve(new BannerInfo {
            Port = port,
            Dev = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") != "Production",
            Ms = stopwatch.ElapsedMilliseconds
        }));

        var shutdown = new TaskCompletionSource();
        using var sigint = PosixSignalRegistration.Create(PosixSignal.SIGINT, Stop);
        using var sigterm = PosixSignalRegistration.Create(PosixSignal.SIGTERM, Stop);

        await shutdown.Task;

        await server.StopAsync(CancellationToken.None);
        await Container.DisposeAsync();

        void Stop(PosixSignalContext context) {
            context.Cancel = true;
            shutdown.TrySetResult();
        }
    }

    private static IPAddress BindAddress() {
        var host = Environment.GetEnvironmentVariable("HYDRIS_HOST");
        return string.IsNullOrEmpty(host) ? IPAddress.Loopback : IPAddress.Parse(host);
    }
}
