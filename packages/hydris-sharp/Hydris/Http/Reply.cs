using System.Collections.Frozen;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Hydris.Error;
using Hydris.Renderer;
using Microsoft.AspNetCore.Http.Features;

namespace Hydris.Http;

public sealed class Reply {
    private static string RootPath = AppContext.BaseDirectory;
    private static IRenderer? ActiveRenderer;

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
    private readonly byte[] Payload;
    private readonly string? FilePath;
    private List<string>? CookieList;
    private int Code;

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

    // @Temp
    public static Reply TestRender(string template, string args) {
        ArgumentNullException.ThrowIfNull(template);
        ArgumentNullException.ThrowIfNull(args);
        var renderer = ActiveRenderer
            ?? throw new InvalidOperationException("no renderer configured; select one with App.UseRenderer(...)");

        var pending = renderer.RenderAsync(template, args);
        var payload = pending.IsCompletedSuccessfully
            ? pending.Result
            : pending.AsTask().GetAwaiter().GetResult();
        return new Reply(payload, 200, "text/html; charset=utf-8");
    }

    public static async Task<Reply> RenderAsync(string template, string args) {
        ArgumentNullException.ThrowIfNull(template);
        ArgumentNullException.ThrowIfNull(args);
        var renderer = ActiveRenderer
            ?? throw new InvalidOperationException("no renderer configured; select one with App.UseRenderer(...)");

        var payload = await renderer.RenderAsync(template, args);
        return new Reply(payload, 200, "text/html; charset=utf-8");
    }

    internal static void UseRenderer(IRenderer renderer) => ActiveRenderer = renderer;

    public static Reply Json<T>(T value, JsonTypeInfo<T> typeInfo) =>
        new(JsonSerializer.SerializeToUtf8Bytes(value, typeInfo), 200, "application/json; charset=utf-8");

    public static Reply Binary(byte[] data) {
        ArgumentNullException.ThrowIfNull(data);
        return new Reply(data, 200, "application/octet-stream");
    }

    public static Reply File(string path) {
        var resolved = Locate(path);
        return new Reply(resolved, 200, MimeOf(resolved));
    }

    public static Reply FileDownload(string path, string? downloadName = null) {
        var resolved = Locate(path);
        var name = downloadName is { Length: > 0 } ? downloadName : System.IO.Path.GetFileName(resolved);
        return new Reply(resolved, 200, MimeOf(resolved)).Header("Content-Disposition", Disposition(name));
    }

    public static void FileBase(string path) {
        ArgumentException.ThrowIfNullOrEmpty(path);
        RootPath = System.IO.Path.GetFullPath(path);
    }

    public static Reply Redirect(string location, int code = 302) {
        var reply = new Reply([], code, "text/plain; charset=utf-8");
        reply.HeaderMap["Location"] = location;
        return reply;
    }

    public Reply Status(int code) {
        Code = code;
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

    internal string? HeaderValue(string name) => HeaderMap.GetValueOrDefault(name);

    internal IReadOnlyList<string> SetCookies => CookieList ?? [];

    internal async Task WriteTo(IHttpResponseFeature response, IHttpResponseBodyFeature body) {
        response.StatusCode = Code;
        foreach (var (name, value) in HeaderMap)
            response.Headers[name] = value;
        if (CookieList is not null)
            response.Headers.SetCookie = CookieList.ToArray();

        if (FilePath is not null) {
            response.Headers.ContentLength = new System.IO.FileInfo(FilePath).Length;
            await body.SendFileAsync(FilePath, 0, null, CancellationToken.None);
            return;
        }

        response.Headers.ContentLength = Payload.Length;
        await body.Writer.WriteAsync(Payload);
    }

    private static string Locate(string path) {
        var resolved = System.IO.Path.GetFullPath(path, RootPath);
        if (!System.IO.File.Exists(resolved))
            throw new NotFoundException();
        return resolved;
    }

    private static string MimeOf(string path) =>
        MimeTypes.GetValueOrDefault(System.IO.Path.GetExtension(path).ToLowerInvariant(), "application/octet-stream");

    private static string Disposition(string name) {
        var fallback = name.Replace("\"", string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);
        return $"attachment; filename=\"{fallback}\"; filename*=UTF-8''{Uri.EscapeDataString(name)}";
    }
}
