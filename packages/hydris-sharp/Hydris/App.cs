using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using Hydris.Cli;
using Hydris.Container;
using Hydris.Core;
using Hydris.Error;
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
    }

    public App Use<T>() where T : IMiddleware {
        Middlewares.Add(typeof(T));
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

        var rendererCount = int.TryParse(Environment.GetEnvironmentVariable("SIDECARS"), out var n) && n > 0
            ? n
            : Math.Min(Environment.ProcessorCount, 8);

        using var loggerFactory = LoggerFactory.Create(builder =>
            builder.AddSimpleConsole(o => o.SingleLine = true).SetMinimumLevel(LogLevel.Warning));

        await using var render = await Manager.StartAsync(new ManagerOptions { SidecarCount = rendererCount });

        var kestrel = new KestrelServerOptions();
        kestrel.Listen(IPAddress.Loopback, port);

        var transport = new SocketTransportFactory(
            Options.Create(new SocketTransportOptions()),
            loggerFactory);

        using var server = new KestrelServer(Options.Create(kestrel), transport, loggerFactory);

        await server.StartAsync(new Dispatcher(Routes, Container, TrustProxy, Middlewares, Errors), CancellationToken.None);

        Console.Write(Banner.Serve(new BannerInfo {
            Port = port,
            Dev = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") != "Production",
            Ms = stopwatch.ElapsedMilliseconds,
            Renderers = rendererCount,
        }));

        var shutdown = new TaskCompletionSource();
        using var sigint = PosixSignalRegistration.Create(PosixSignal.SIGINT, Stop);
        using var sigterm = PosixSignalRegistration.Create(PosixSignal.SIGTERM, Stop);

        await shutdown.Task;

        await server.StopAsync(CancellationToken.None);

        void Stop(PosixSignalContext context) {
            context.Cancel = true;
            shutdown.TrySetResult();
        }
    }
}
