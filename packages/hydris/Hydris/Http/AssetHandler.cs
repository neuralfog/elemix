using System.IO;
using Hydris.Error;

namespace Hydris.Http;

internal sealed class AssetConfig {
    private const int DefaultMaxAge = 31_536_000;

    public string Dir { get; }
    public string CacheControl { get; }

    public AssetConfig(string dir, AssetOptions options) {
        Dir = Path.GetFullPath(dir, AppContext.BaseDirectory);
        CacheControl = ComposeCacheControl(options);
    }

    private static string ComposeCacheControl(AssetOptions options) {
        if (options.Immutable)
            return $"public, max-age={options.MaxAge ?? DefaultMaxAge}, immutable";
        if (options.MaxAge is int maxAge)
            return $"public, max-age={maxAge}";
        return "no-cache";
    }
}

internal static class AssetHandler {
    public static Reply Serve(Request request, AssetConfig config) {
        var relative = request.Param("*");
        if (string.IsNullOrEmpty(relative))
            throw new NotFoundException();

        var target = Path.GetFullPath(Path.Join(config.Dir, relative));
        if (!Within(target, config.Dir) || !File.Exists(target))
            throw new NotFoundException();

        var etag = Etag(new FileInfo(target));
        if (request.Header("If-None-Match") == etag)
            return Reply.NotModified(etag, config.CacheControl);

        var contentType = Reply.MimeOf(target);
        var choice = Compressor.NegotiateStatic(target, contentType, request.Header("Accept-Encoding"));
        return Reply.AssetFile(choice.Path, contentType, etag, config.CacheControl, choice.Encoding, choice.Vary);
    }

    public static Reply ServeElemix(Request request, AssetConfig config) {
        var name = request.Param("*");
        if (name is null || !IsElemixAsset(name))
            throw new NotFoundException();
        return Serve(request, config);
    }

    private static bool IsElemixAsset(string name) {
        if (name.Length == 0 || !name.EndsWith(".js", StringComparison.Ordinal))
            return false;
        foreach (var c in name) {
            if (!char.IsAsciiLetterOrDigit(c) && c != '.' && c != '_' && c != '-')
                return false;
        }

        return true;
    }

    private static bool Within(string target, string dir) =>
        target == dir || target.StartsWith(dir + Path.DirectorySeparatorChar, StringComparison.Ordinal);

    private static string Etag(FileInfo info) =>
        $"W/\"{info.LastWriteTimeUtc.Ticks:x}-{info.Length:x}\"";
}
