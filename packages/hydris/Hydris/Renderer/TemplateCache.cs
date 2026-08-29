using System.Collections.Concurrent;

namespace Hydris.Renderer;

public sealed class TemplateCache : IRenderer, IDisposable {
    private readonly IRenderer Inner;
    private readonly ConcurrentDictionary<string, CachedView> Cache = [];

    public TemplateCache(IRenderer inner) {
        ArgumentNullException.ThrowIfNull(inner);
        Inner = inner;
    }

    public byte[] Render(string bundlePath, string? data) =>
        data is null ? View(bundlePath).Html : Inner.Render(bundlePath, data);

    internal CachedView View(string bundlePath) {
        ArgumentException.ThrowIfNullOrEmpty(bundlePath);
        return Cache.GetOrAdd(bundlePath, static (path, inner) => new CachedView(inner.Render(path, null)), Inner);
    }

    public void Dispose() => (Inner as IDisposable)?.Dispose();
}
