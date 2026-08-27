// @Note
// PHP-fpm style socket manager
//
// This is an interesting concept and it solves one problem: cold start.
// It works, but it is not good enough for what I am actually aiming for.
//
// c# + Kestrel + hydris core throughput on this machine is over 800k - 850k requests per second.
// A single bun process gets to about 50k with barely any work.
// Even running 8 managed bun processes I am not able to match it. I get around 400k,
// that's 50%.
//
// 8 bun instances are not able to match it... 8 processes take around 800mb of memory when idling.
// 64 connections multiplexed over 8 Bun processes, and it's still not enough. FML
// A single bun process idles at around 90 - 100mb.
//
// I need to check alternatives such as an embedded runtime, maybe a better fit. Precompiled
// SSR js is just string concatenation + interpolation and #before-mount, really not that much...
//
// Could be just fine-tuning; one way or another I am making this work or die trying :|
//

using System.Buffers.Binary;
using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Channels;

namespace Hydris.Renderer;

public sealed class ManagerOptions {
    public int SidecarCount { get; init; } = Math.Min(Environment.ProcessorCount, 8);
    public int ConnectionsPerSidecar { get; init; } = 8;
    public string Command { get; init; } = "bun";
    public string SocketDirectory { get; init; } = "/tmp";
    public string SocketPrefix { get; init; } = "hydris-render";
    public TimeSpan StartupTimeout { get; init; } = TimeSpan.FromSeconds(10);
}

public sealed class Manager : IAsyncDisposable {
    private const string EmbeddedScript = "Hydris.Renderer.sidecar.ts";

    private readonly Process[] Sidecars;
    private readonly Channel<Connection> Pool;
    private readonly string ScriptPath;
    private readonly Timer Meter;

    private Manager(Process[] sidecars, Channel<Connection> pool, string scriptPath) {
        Sidecars = sidecars;
        Pool = pool;
        ScriptPath = scriptPath;
        Meter = new Timer(_ => LogMemory(), null, TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(3));
    }

    private void LogMemory() {
        long rss = 0;
        var alive = 0;
        foreach (var sidecar in Sidecars) {
            try {
                sidecar.Refresh();
                if (!sidecar.HasExited) {
                    rss += sidecar.WorkingSet64;
                    alive++;
                }
            } catch (InvalidOperationException) {
                continue;
            }
        }

        Console.WriteLine($"[bun] {alive} sidecars, {rss / 1024.0 / 1024.0:F1} MB RSS total ({(alive > 0 ? rss / alive / 1024.0 / 1024.0 : 0):F1} MB each)");
    }

    public static async Task<Manager> StartAsync(ManagerOptions options, CancellationToken ct = default) {
        ArgumentNullException.ThrowIfNull(options);

        var scriptPath = ExtractEmbeddedScript();

        var sockets = new string[options.SidecarCount];
        var sidecars = new Process[options.SidecarCount];
        for (var i = 0; i < options.SidecarCount; i++) {
            sockets[i] = Path.Combine(options.SocketDirectory, $"{options.SocketPrefix}-{i}.sock");
            sidecars[i] = StartSidecar(options, scriptPath, sockets[i]);
        }

        foreach (var socket in sockets)
            await WaitForSocket(socket, options.StartupTimeout, ct);

        var total = options.SidecarCount * options.ConnectionsPerSidecar;
        var pool = Channel.CreateBounded<Connection>(total);
        foreach (var socket in sockets)
            for (var i = 0; i < options.ConnectionsPerSidecar; i++)
                pool.Writer.TryWrite(new Connection(socket));

        return new Manager(sidecars, pool, scriptPath);
    }

    public async Task<byte[]> RenderAsync(string source, CancellationToken ct) {
        var connection = await Pool.Reader.ReadAsync(ct);
        try {
            return await connection.RenderAsync(source, ct);
        } finally {
            await Pool.Writer.WriteAsync(connection, ct);
        }
    }

    public async ValueTask DisposeAsync() {
        await Meter.DisposeAsync();

        Pool.Writer.TryComplete();
        while (Pool.Reader.TryRead(out var connection))
            await connection.DisposeAsync();

        foreach (var sidecar in Sidecars) {
            if (!sidecar.HasExited)
                sidecar.Kill(entireProcessTree: true);
            sidecar.Dispose();
        }

        if (File.Exists(ScriptPath))
            File.Delete(ScriptPath);
    }

    private static string ExtractEmbeddedScript() {
        var assembly = typeof(Manager).Assembly;
        using var stream = assembly.GetManifestResourceStream(EmbeddedScript)
            ?? throw new InvalidOperationException($"embedded render script '{EmbeddedScript}' not found");

        var path = Path.Combine(Path.GetTempPath(), $"hydris-render-{Guid.NewGuid():N}.ts");
        using var file = File.Create(path);
        stream.CopyTo(file);
        return path;
    }

    private static Process StartSidecar(ManagerOptions options, string scriptPath, string socketPath) {
        var info = new ProcessStartInfo {
            FileName = options.Command,
            Arguments = $"run {scriptPath}",
            UseShellExecute = false,
            Environment = { ["RENDER_SOCK"] = socketPath },
        };

        return Process.Start(info)
            ?? throw new InvalidOperationException(
                $"failed to start render process: {options.Command} run {scriptPath}");
    }

    private static async Task WaitForSocket(string path, TimeSpan timeout, CancellationToken ct) {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline) {
            try {
                using var probe = new Socket(
                    AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                await probe.ConnectAsync(new UnixDomainSocketEndPoint(path), ct);
                return;
            } catch (SocketException) {
                await Task.Delay(50, ct);
            }
        }

        throw new TimeoutException($"render process did not come up at {path}");
    }

    private sealed class Connection(string socketPath) : IAsyncDisposable {
        private readonly byte[] Header = new byte[4];
        private Socket? Socket;
        private NetworkStream? Stream;

        public async Task<byte[]> RenderAsync(string source, CancellationToken ct) {
            await EnsureConnected(ct);

            var payload = Encoding.UTF8.GetBytes(source);
            var frame = new byte[4 + payload.Length];
            BinaryPrimitives.WriteUInt32LittleEndian(frame, (uint)payload.Length);
            payload.CopyTo(frame.AsSpan(4));
            await Stream!.WriteAsync(frame, ct);

            await Stream.ReadExactlyAsync(Header, ct);
            var length = (int)BinaryPrimitives.ReadUInt32LittleEndian(Header);
            var body = new byte[length];
            await Stream.ReadExactlyAsync(body, ct);
            return body;
        }

        private async Task EnsureConnected(CancellationToken ct) {
            if (Socket is { Connected: true })
                return;
            Socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
            await Socket.ConnectAsync(new UnixDomainSocketEndPoint(socketPath), ct);
            Stream = new NetworkStream(Socket, ownsSocket: true);
        }

        public async ValueTask DisposeAsync() {
            if (Stream is not null)
                await Stream.DisposeAsync();
            Socket?.Dispose();
        }
    }
}
