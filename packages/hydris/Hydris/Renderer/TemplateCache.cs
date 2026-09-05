using System.Collections.Concurrent;
using System.Diagnostics;

namespace Hydris.Renderer;

public sealed class TemplateCache : IRenderer, IDisposable {
    private readonly IRenderer Inner;
    private readonly ConcurrentDictionary<string, CachedView> Cache = [];

    public TemplateCache(IRenderer inner) {
        Debug.Assert(inner is not null);
        Inner = inner;
    }

    public byte[] Render(string key, byte[] bytecode, string? data) =>
        data is null ? View(key, bytecode).Html : Inner.Render(key, bytecode, data);

    internal CachedView View(string key, byte[] bytecode) {
        ArgumentException.ThrowIfNullOrEmpty(key);
        return Cache.GetOrAdd(
            key,
            static (k, arg) => new CachedView(arg.Inner.Render(k, arg.bytecode, null)),
            (Inner, bytecode));
    }

    public void Dispose() => (Inner as IDisposable)?.Dispose();
}
