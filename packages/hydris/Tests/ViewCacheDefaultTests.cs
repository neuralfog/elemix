using Hydris.Container;
using Hydris.Core;
using Hydris.Http;
using Hydris.Renderer;
using Hydris.Routing;
using Microsoft.AspNetCore.Http;

namespace Hydris.Tests;

public sealed class ViewCacheDefaultTests : IDisposable {
    private sealed class CountingRenderer : IRenderer {
        public int Calls;

        public byte[] Render(string key, byte[] bytecode, string? data) {
            Calls++;
            return "<html><body>ok</body></html>"u8.ToArray();
        }
    }

    private static readonly string SsrRoot = Path.Combine(AppContext.BaseDirectory, "ssr");
    private readonly List<string> Written = [];

    private void WriteBundle(string view) {
        Directory.CreateDirectory(SsrRoot);
        var path = Path.Combine(SsrRoot, view + ".ebc");
        File.WriteAllBytes(path, [1, 2, 3]);
        Written.Add(path);
    }

    public void Dispose() {
        foreach (var path in Written) {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    private static (Request Request, DiContainer Scope) Scope() {
        var container = new DiContainer();
        new CoreServiceProvider().Register(container);
        var request = new Request(Method.Get, "/", new Dictionary<string, string>(), new HeaderDictionary());
        return (request, CoreServiceProvider.RequestScope(container, request));
    }

    [Fact]
    public void ViewDoesNotCacheByDefault() {
        WriteBundle("m3_default");
        Views.UseRenderer(new CountingRenderer());
        var (request, scope) = Scope();
        var before = ViewCache.Instance.Count;

        Reply.View("m3_default").Materialize(request, scope);

        Assert.Equal(before, ViewCache.Instance.Count);
    }

    [Fact]
    public void CacheOptsIntoCaching() {
        WriteBundle("m3_optin");
        Views.UseRenderer(new CountingRenderer());
        var (request, scope) = Scope();
        var before = ViewCache.Instance.Count;

        Reply.View("m3_optin").Cache().Materialize(request, scope);

        Assert.Equal(before + 1, ViewCache.Instance.Count);
    }
}
