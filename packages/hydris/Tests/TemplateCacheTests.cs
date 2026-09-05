using System.Text;
using Hydris.Renderer;

namespace Hydris.Tests;

public sealed class TemplateCacheTests {
    private static readonly byte[] Bytecode = [];

    private sealed class CountingRenderer : IRenderer {
        public int Calls { get; private set; }

        public byte[] Render(string key, byte[] bytecode, string? data) {
            Calls++;
            return Encoding.UTF8.GetBytes($"rendered:{key}");
        }
    }

    private sealed class DisposableRenderer : IRenderer, IDisposable {
        public bool DisposedCalled { get; private set; }

        public byte[] Render(string key, byte[] bytecode, string? data) => [];
        public void Dispose() => DisposedCalled = true;
    }

    [Fact]
    public void RendersOnceThenServesFromCache() {
        var inner = new CountingRenderer();
        var cache = new TemplateCache(inner);

        var first = cache.Render("Views/Pages/Home", Bytecode, null);
        var second = cache.Render("Views/Pages/Home", Bytecode, null);

        Assert.Equal(1, inner.Calls);
        Assert.Equal("rendered:Views/Pages/Home", Encoding.UTF8.GetString(first));
        Assert.Same(first, second);
    }

    [Fact]
    public void DistinctViewsRenderIndependently() {
        var inner = new CountingRenderer();
        var cache = new TemplateCache(inner);

        cache.Render("Views/Pages/Home", Bytecode, null);
        cache.Render("Views/Pages/About", Bytecode, null);
        cache.Render("Views/Pages/Home", Bytecode, null);

        Assert.Equal(2, inner.Calls);
    }

    [Fact]
    public void DisposesTheInnerRenderer() {
        var inner = new DisposableRenderer();
        var cache = new TemplateCache(inner);

        cache.Dispose();

        Assert.True(inner.DisposedCalled);
    }
}
