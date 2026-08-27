using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace Hydris.Renderer;

public sealed class QuickJsRenderer : IRenderer, IDisposable {
    private sealed class Engine {
        public IntPtr Handle;
        public readonly Dictionary<string, IntPtr> Compiled = [];
    }

    private readonly ConcurrentBag<Engine> Engines = [];
    private int Created;
    private bool Disposed;

    public ValueTask<byte[]> RenderAsync(string template, string args) {
        ObjectDisposedException.ThrowIf(Disposed, this);

        if (!Engines.TryTake(out var engine)) {
            engine = new Engine { Handle = QuickJs.New() };
            Console.WriteLine($"[quickjs] engines created: {Interlocked.Increment(ref Created)}");
        }

        try {
            if (!engine.Compiled.TryGetValue(template, out var function)) {
                function = QuickJs.Compile(engine.Handle, template);
                if (function == IntPtr.Zero)
                    throw new InvalidOperationException("template failed to compile");
                engine.Compiled[template] = function;
            }

            var pointer = QuickJs.Call(engine.Handle, function, args, out var length);
            var bytes = new byte[length];
            if (length > 0)
                Marshal.Copy(pointer, bytes, 0, length);
            QuickJs.FreeString(pointer);
            return ValueTask.FromResult(bytes);
        } finally {
            Engines.Add(engine);
        }
    }

    public void Dispose() {
        if (Disposed)
            return;
        Disposed = true;

        long total = 0;
        var count = 0;
        while (Engines.TryTake(out var engine)) {
            total += QuickJs.Memory(engine.Handle);
            count++;
            foreach (var function in engine.Compiled.Values)
                QuickJs.FreeFunction(engine.Handle, function);
            QuickJs.Close(engine.Handle);
        }

        Console.WriteLine($"[quickjs] {count} engines, {total / 1024.0 / 1024.0:F2} MB total ({(count > 0 ? total / count / 1024.0 : 0):F0} KB each)");
    }
}
