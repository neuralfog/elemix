using System.Collections.Frozen;
using System.Text;
using Hydris.Renderer;

namespace Hydris.Http;

internal static class Views {
    private static readonly byte[] BodyClose = "</body>"u8.ToArray();

    private static readonly string Root = Path.Combine(AppContext.BaseDirectory, "ssr");
    private static IRenderer? Renderer;
    private static ElemixManifest? Manifest;
    private static FrozenDictionary<string, byte[]> Bundles =
        FrozenDictionary<string, byte[]>.Empty;

    internal static void UseRenderer(IRenderer renderer) {
        Renderer = renderer;
        Bundles = LoadBundles(Root);
    }

    internal static void UseManifest(ElemixManifest manifest) => Manifest = manifest;

    private static FrozenDictionary<string, byte[]> LoadBundles(string root) {
        if (!Directory.Exists(root))
            return FrozenDictionary<string, byte[]>.Empty;
        var map = new Dictionary<string, byte[]>();
        foreach (var file in Directory.EnumerateFiles(root, "*.ebc", SearchOption.AllDirectories))
            map[file] = File.ReadAllBytes(file);
        return map.ToFrozenDictionary();
    }

    internal static byte[] Render(string view, string? context) {
        ArgumentException.ThrowIfNullOrEmpty(view);
        var renderer = Renderer
            ?? throw new InvalidOperationException("no renderer configured");

        var bundle = Path.Combine(Root, view.Replace('/', Path.DirectorySeparatorChar) + ".ebc");
        if (!Bundles.TryGetValue(bundle, out var bytecode))
            throw new InvalidOperationException($"view bundle not found: {bundle}");

        return Inject(view, renderer.Render(bundle, bytecode, context));
    }

    private static byte[] Inject(string view, byte[] html) {
        var hashed = Manifest?.Resolve(view);
        if (hashed is null)
            return html;

        var script = Encoding.UTF8.GetBytes($"<script type=\"module\" src=\"/_elemix/{hashed}\"></script>");
        var at = html.AsSpan().LastIndexOf(BodyClose);
        var composed = new byte[html.Length + script.Length];
        if (at < 0) {
            html.CopyTo(composed, 0);
            script.CopyTo(composed, html.Length);
            return composed;
        }

        Array.Copy(html, 0, composed, 0, at);
        script.CopyTo(composed, at);
        Array.Copy(html, at, composed, at + script.Length, html.Length - at);
        return composed;
    }
}
