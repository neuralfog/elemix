using System.Text;
using Hydris.Renderer;

namespace Hydris.Http;

internal static class Views {
    private static readonly byte[] BodyClose = "</body>"u8.ToArray();

    private static readonly string Root = Path.Combine(AppContext.BaseDirectory, "ssr");
    private static IRenderer? Renderer;
    private static ElemixManifest? Manifest;

    internal static void UseRenderer(IRenderer renderer) => Renderer = renderer;

    internal static void UseManifest(ElemixManifest manifest) => Manifest = manifest;

    internal static byte[] Render(string view, string? context) {
        ArgumentException.ThrowIfNullOrEmpty(view);
        var renderer = Renderer
            ?? throw new InvalidOperationException("no renderer configured");

        var bundle = Path.Combine(Root, view.Replace('/', Path.DirectorySeparatorChar) + ".ebc");
        if (!File.Exists(bundle))
            throw new InvalidOperationException($"view bundle not found: {bundle}");

        var html = renderer is TemplateCache cache && context is null
            ? cache.View(bundle).Html
            : renderer.Render(bundle, context);
        return Inject(view, html);
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
