using Hydris.Renderer;

namespace Hydris.Http;

internal static class ViewCache {
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Reap = TimeSpan.FromMinutes(2);

    internal static RenderCache<CachedView> Instance { get; } = new(Ttl, Reap);
}
