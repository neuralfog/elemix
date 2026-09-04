using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Hydris.Renderer;

namespace Hydris.QuickJs;

public sealed class QuickJsRenderer : IRenderer, IDisposable {
    private sealed class Engine {
        public IntPtr Handle { get; init; }
        public string? LoadedPath { get; set; }
        public long LastUsed { get; set; }
    }

    private static readonly long IdleTicks = Stopwatch.Frequency * 30;
    private static readonly TimeSpan ReapInterval = TimeSpan.FromSeconds(10);

    private readonly ConcurrentBag<Engine> Engines = [];
    private readonly Timer Reaper;
    private bool Disposed;
    private int Live;

    public QuickJsRenderer() {
        Engines.Add(new Engine { Handle = QuickJs.New(), LastUsed = Stopwatch.GetTimestamp() });
        Live = 1;
        Reaper = new Timer(static state => ((QuickJsRenderer)state!).Reap(), this, ReapInterval, ReapInterval);
    }

    // @Todo
    // c runtime segfaults on fseek()
    // IMPORTNAT: check if bundle abvailable before passing down via inetrop
    // throw from level of c#
    public byte[] Render(string bundlePath, string? data) {
        ObjectDisposedException.ThrowIf(Disposed, this);
        ArgumentException.ThrowIfNullOrEmpty(bundlePath);

        if (!Engines.TryTake(out var engine)) {
            engine = new Engine { Handle = QuickJs.New() };
            Interlocked.Increment(ref Live);
        }

        try {
            if (engine.LoadedPath != bundlePath) {
                var bytecode = File.ReadAllBytes(bundlePath);
                var error = QuickJs.LoadBytecode(engine.Handle, bytecode, bytecode.Length);
                if (error != IntPtr.Zero) {
                    var message = Marshal.PtrToStringUTF8(error) ?? "bundle failed to load";
                    QuickJs.FreeString(error);
                    throw new InvalidOperationException($"{bundlePath}: {message}");
                }
                engine.LoadedPath = bundlePath;
            }

            var pointer = QuickJs.Render(engine.Handle, data ?? string.Empty, out var length);
            var bytes = new byte[length];
            if (length > 0)
                Marshal.Copy(pointer, bytes, 0, length);
            QuickJs.FreeRender(engine.Handle);
            return bytes;
        } finally {
            engine.LastUsed = Stopwatch.GetTimestamp();
            Engines.Add(engine);
        }
    }

    private void Reap() {
        if (Disposed)
            return;

        var now = Stopwatch.GetTimestamp();
        List<Engine>? survivors = null;
        while (Engines.TryTake(out var engine)) {
            if (now - engine.LastUsed < IdleTicks) {
                (survivors ??= []).Add(engine);
                continue;
            }

            if (!TryReclaim()) {
                (survivors ??= []).Add(engine);
                continue;
            }

            QuickJs.Close(engine.Handle);
        }

        if (survivors is null)
            return;
        foreach (var engine in survivors)
            Engines.Add(engine);
    }

    private bool TryReclaim() {
        while (true) {
            var current = Volatile.Read(ref Live);
            if (current <= 1)
                return false;
            if (Interlocked.CompareExchange(ref Live, current - 1, current) == current)
                return true;
        }
    }

    public void Dispose() {
        if (Disposed)
            return;
        Disposed = true;
        Reaper.Dispose();
        while (Engines.TryTake(out var engine))
            QuickJs.Close(engine.Handle);
    }
}
