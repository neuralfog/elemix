using System.Buffers;
using System.Collections.Frozen;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Hydris.Error;
using Microsoft.AspNetCore.Http.Features;

namespace Hydris.Http;

public sealed class Reply {
    private static string RootPath = AppContext.BaseDirectory;

    private static readonly FrozenDictionary<string, string> MimeTypes = new Dictionary<string, string> {
        [".html"] = "text/html; charset=utf-8",
        [".htm"] = "text/html; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".mjs"] = "text/javascript; charset=utf-8",
        [".json"] = "application/json; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8",
        [".csv"] = "text/csv; charset=utf-8",
        [".xml"] = "application/xml",
        [".svg"] = "image/svg+xml",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".avif"] = "image/avif",
        [".ico"] = "image/x-icon",
        [".pdf"] = "application/pdf",
        [".zip"] = "application/zip",
        [".gz"] = "application/gzip",
        [".wasm"] = "application/wasm",
        [".mp3"] = "audio/mpeg",
        [".wav"] = "audio/wav",
        [".ogg"] = "audio/ogg",
        [".mp4"] = "video/mp4",
        [".webm"] = "video/webm",
        [".woff"] = "font/woff",
        [".woff2"] = "font/woff2",
        [".ttf"] = "font/ttf",
        [".otf"] = "font/otf",
    }.ToFrozenDictionary();

    private readonly Dictionary<string, string> HeaderMap;
    private byte[] Payload;
    private readonly string? FilePath;
    private List<string>? CookieList;
    private int Code;
    private PendingRender? Pending;

    private Reply(byte[] payload, int code, string contentType) {
        Payload = payload;
        Code = code;
        HeaderMap = new Dictionary<string, string> { ["Content-Type"] = contentType };
    }

    private Reply(string filePath, int code, string contentType) {
        Payload = [];
        FilePath = filePath;
        Code = code;
        HeaderMap = new Dictionary<string, string> { ["Content-Type"] = contentType };
    }

    public static Reply Text(string body) =>
        new(Encoding.UTF8.GetBytes(body), 200, "text/plain; charset=utf-8");

    public static Reply Html(string body) =>
        new(Encoding.UTF8.GetBytes(body), 200, "text/html; charset=utf-8");

    public static Reply View(string view) {
        ArgumentException.ThrowIfNullOrEmpty(view);
        return new Reply([], 200, "text/html; charset=utf-8") {
            Pending = new PendingRender(view, null, CacheMode.Default),
        };
    }

    public static Reply View<T>(string view, T data) where T : IViewData {
        ArgumentException.ThrowIfNullOrEmpty(view);
        Debug.Assert(data is not null);
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
            data.Write(writer);
        return new Reply([], 200, "text/html; charset=utf-8") {
            Pending = new PendingRender(view, Encoding.UTF8.GetString(buffer.WrittenSpan), CacheMode.Default),
        };
    }

    internal void Materialize(Request request) {
        if (Pending is not { } pending)
            return;
        Pending = null;
        var stores = new CookieAuthority(request).Stores();
        if (pending.Cache == CacheMode.None) {
            Payload = Views.Render(pending.View, Context(pending.ViewData, stores));
            return;
        }
        var key = RenderCache<Renderer.CachedView>.Key(pending.View, pending.ViewData ?? string.Empty, stores);
        if (ViewCache.Instance.TryGet(key, out var hit)) {
            Payload = hit.Html;
            Cached = hit;
            return;
        }
        Payload = Views.Render(pending.View, Context(pending.ViewData, stores));
        var view = new Renderer.CachedView(Payload);
        if (pending.Cache == CacheMode.Infinite)
            ViewCache.Instance.SetForever(key, view);
        else
            ViewCache.Instance.Set(key, view);
    }

    private static string Context(string? viewData, string stores) {
        var builder = new StringBuilder("{\"stores\":");
        builder.Append(stores);
        if (viewData is not null)
            builder.Append(",\"viewData\":").Append(viewData);
        return builder.Append('}').ToString();
    }

    public static Reply Json<T>(T value, JsonTypeInfo<T> typeInfo) =>
        new(JsonSerializer.SerializeToUtf8Bytes(value, typeInfo), 200, "application/json; charset=utf-8");

    public static Reply Binary(byte[] data) {
        Debug.Assert(data is not null);
        return new Reply(data, 200, "application/octet-stream");
    }

    public static Reply File(string path) {
        var resolved = Locate(path);
        return new Reply(resolved, 200, MimeOf(resolved));
    }

    public static Reply FileDownload(string path, string? downloadName = null) {
        var resolved = Locate(path);
        var name = downloadName is { Length: > 0 } ? downloadName : Path.GetFileName(resolved);
        return new Reply(resolved, 200, MimeOf(resolved)).Header("Content-Disposition", Disposition(name));
    }

    public static void FileBase(string path) {
        ArgumentException.ThrowIfNullOrEmpty(path);
        RootPath = Path.GetFullPath(path);
    }

    public static Reply Redirect(string location, int code = 302) {
        var reply = new Reply([], code, "text/plain; charset=utf-8");
        reply.HeaderMap["Location"] = location;
        return reply;
    }

    public static Reply NotModified(string etag, string cacheControl) {
        var reply = new Reply([], 304, "text/plain; charset=utf-8");
        reply.HeaderMap["ETag"] = etag;
        reply.HeaderMap["Cache-Control"] = cacheControl;
        return reply;
    }

    internal static Reply AssetFile(
        string filePath, string contentType, string etag, string cacheControl, string? encoding, bool vary) {
        var reply = new Reply(filePath, 200, contentType);
        reply.HeaderMap["ETag"] = etag;
        reply.HeaderMap["Cache-Control"] = cacheControl;
        if (encoding is not null)
            reply.HeaderMap["Content-Encoding"] = encoding;
        if (vary)
            reply.AppendVary();
        return reply;
    }

    public Reply Status(int code) {
        Code = code;
        return this;
    }

    public Reply NoCache() {
        if (Pending is { } pending)
            Pending = pending with { Cache = CacheMode.None };
        return this;
    }

    public Reply InfiniteCache() {
        if (Pending is { } pending)
            Pending = pending with { Cache = CacheMode.Infinite };
        return this;
    }

    public Reply Header(string name, string value) {
        HeaderMap[name] = value;
        return this;
    }

    public Reply Cookie(string name, string value, CookieOptions? options = null) {
        (CookieList ??= []).Add(CookieAuthority.Serialize(name, value, options));
        return this;
    }

    public Reply ClearCookie(string name, CookieOptions? options = null) {
        var cleared = (options ?? new CookieOptions()) with { MaxAge = 0 };
        (CookieList ??= []).Add(CookieAuthority.Serialize(name, string.Empty, cleared));
        return this;
    }

    internal int StatusCode => Code;

    internal byte[] Content => Payload;

    internal string? SourcePath => FilePath;

    internal bool IsFile => FilePath is not null;

    internal Renderer.CachedView? Cached { get; private set; }

    internal void ApplyEncoding(byte[] encoded, string encoding) {
        Payload = encoded;
        HeaderMap["Content-Encoding"] = encoding;
        AppendVary();
    }

    internal void AppendVary() {
        if (!HeaderMap.TryGetValue("Vary", out var existing)) {
            HeaderMap["Vary"] = "Accept-Encoding";
            return;
        }
        if (existing.Contains("Accept-Encoding", StringComparison.OrdinalIgnoreCase))
            return;
        HeaderMap["Vary"] = $"{existing}, Accept-Encoding";
    }

    internal string? HeaderValue(string name) => HeaderMap.GetValueOrDefault(name);

    internal IReadOnlyList<string> SetCookies => CookieList ?? [];

    internal async Task WriteTo(
        IHttpResponseFeature response, IHttpResponseBodyFeature body, bool head, CancellationToken cancellationToken) {
        response.StatusCode = Code;
        foreach (var (name, value) in HeaderMap)
            response.Headers[name] = value;
        if (CookieList is not null)
            response.Headers.SetCookie = CookieList.ToArray();

        if (FilePath is not null) {
            response.Headers.ContentLength = new FileInfo(FilePath).Length;
            if (!head)
                await body.SendFileAsync(FilePath, 0, null, cancellationToken);
            return;
        }

        response.Headers.ContentLength = Payload.Length;
        if (!head)
            await body.Writer.WriteAsync(Payload, cancellationToken);
    }

    private static string Locate(string path) {
        var resolved = Path.GetFullPath(path, RootPath);
        if (!System.IO.File.Exists(resolved))
            throw new NotFoundException();
        return resolved;
    }

    internal static string MimeOf(string path) =>
        MimeTypes.GetValueOrDefault(Path.GetExtension(path).ToLowerInvariant(), "application/octet-stream");

    private static string Disposition(string name) {
        var fallback = name.Replace("\"", string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);
        return $"attachment; filename=\"{fallback}\"; filename*=UTF-8''{Uri.EscapeDataString(name)}";
    }

    private enum CacheMode : byte {
        Default,
        None,
        Infinite,
    }

    private readonly record struct PendingRender(string View, string? ViewData, CacheMode Cache);
}
