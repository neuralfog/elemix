using System.Collections.Frozen;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using Hydris.Renderer;
using Hydris.Routing;

namespace Hydris.Http;

internal enum ContentEncoding {
    Brotli,
    Gzip,
}

internal sealed record CompressionSettings(int Threshold, bool Brotli, bool Gzip);

internal readonly record struct StaticChoice(string Path, string? Encoding, bool Vary);

internal static class Compressor {
    private const int DefaultThreshold = 1024;
    private const int DynamicBrotliQuality = 5;
    private const int StaticBrotliQuality = 11;
    private const int BrotliWindow = 22;
    private const CompressionLevel DynamicGzipLevel = CompressionLevel.Optimal;
    private const CompressionLevel StaticGzipLevel = CompressionLevel.SmallestSize;

    private static CompressionSettings? Settings;
    private static bool Locked;

    private static readonly FrozenSet<string> CompressibleTypes = new[] {
        "application/json",
        "application/javascript",
        "application/xml",
        "application/rss+xml",
        "application/atom+xml",
        "application/manifest+json",
        "application/ld+json",
        "application/wasm",
        "application/x-javascript",
        "image/svg+xml",
        "image/x-icon",
        "font/ttf",
        "font/otf",
    }.ToFrozenSet(StringComparer.Ordinal);

    internal static void Configure(CompressionOptions options) {
        Debug.Assert(options is not null);
        if (Locked)
            throw new InvalidOperationException(
                "Compression must be configured before Serve; it locks once the server boots.");
        Settings = new CompressionSettings(
            options.Threshold ?? DefaultThreshold,
            options.Brotli ?? true,
            options.Gzip ?? true);
    }

    internal static bool Enabled => Settings is not null;

    internal static void Lock() => Locked = true;

    internal static void Reset() {
        Settings = null;
        Locked = false;
    }

    internal static StaticChoice NegotiateStatic(string path, string contentType, string? acceptEncoding) {
        var settings = Settings;
        if (settings is null)
            return new StaticChoice(path, null, false);
        if (!IsCompressible(contentType))
            return new StaticChoice(path, null, true);

        var encoding = Negotiate(acceptEncoding, settings);
        if (encoding is null)
            return new StaticChoice(path, null, true);

        var sibling = path + SiblingExtension(encoding.Value);
        if (File.Exists(sibling) && File.GetLastWriteTimeUtc(sibling) >= File.GetLastWriteTimeUtc(path))
            return new StaticChoice(sibling, Token(encoding.Value), true);

        return new StaticChoice(path, null, true);
    }

    internal static void ApplyDynamic(Reply reply, Request request) {
        var settings = Settings;
        if (settings is null)
            return;
        if (request.Method == Method.Head || reply.IsFile)
            return;
        if (reply.HeaderValue("Content-Encoding") is not null)
            return;
        if (!IsCompressibleStatus(reply.StatusCode) || !IsCompressible(reply.HeaderValue("Content-Type")))
            return;

        reply.AppendVary();
        var encoding = Negotiate(request.Header("Accept-Encoding"), settings);
        if (encoding is null)
            return;

        var body = reply.Content;
        if (body.Length < settings.Threshold)
            return;

        var cached = reply.Cached;
        var encoded = cached is not null
            ? cached.Encoded(encoding.Value)
            : Compress(body, encoding.Value, DynamicBrotliQuality, DynamicGzipLevel);
        reply.ApplyEncoding(encoded, Token(encoding.Value));
    }

    internal static byte[] Encode(byte[] body, ContentEncoding encoding) =>
        Compress(body, encoding, StaticBrotliQuality, StaticGzipLevel);

    internal static bool IsCompressible(string? contentType) {
        if (string.IsNullOrEmpty(contentType))
            return false;
        var semi = contentType.IndexOf(';');
        var type = (semi < 0 ? contentType : contentType[..semi]).Trim().ToLowerInvariant();
        if (type.StartsWith("text/", StringComparison.Ordinal))
            return true;
        if (type.EndsWith("+json", StringComparison.Ordinal) || type.EndsWith("+xml", StringComparison.Ordinal))
            return true;
        return CompressibleTypes.Contains(type);
    }

    internal static ContentEncoding? Negotiate(string? header, CompressionSettings settings) {
        if (string.IsNullOrEmpty(header))
            return null;

        double brotli = -1;
        double gzip = -1;
        double star = -1;
        foreach (var part in header.Split(',')) {
            var segment = part.Trim();
            if (segment.Length == 0)
                continue;
            var semi = segment.IndexOf(';');
            var token = (semi < 0 ? segment : segment[..semi]).Trim().ToLowerInvariant();
            var quality = ParseQuality(semi < 0 ? null : segment[(semi + 1)..]);
            if (token == "br")
                brotli = quality;
            else if (token == "gzip")
                gzip = quality;
            else if (token == "*")
                star = quality;
        }

        var brotliQuality = brotli >= 0 ? brotli : star;
        var gzipQuality = gzip >= 0 ? gzip : star;

        ContentEncoding? best = null;
        double bestQuality = 0;
        if (settings.Brotli && brotliQuality > 0) {
            best = ContentEncoding.Brotli;
            bestQuality = brotliQuality;
        }
        if (settings.Gzip && gzipQuality > 0 && (best is null || gzipQuality > bestQuality))
            best = ContentEncoding.Gzip;

        return best;
    }

    private static double ParseQuality(string? parameters) {
        if (parameters is null)
            return 1;
        foreach (var part in parameters.Split(';')) {
            var segment = part.Trim();
            if (segment.StartsWith("q=", StringComparison.OrdinalIgnoreCase)
                && double.TryParse(segment.AsSpan(2), NumberStyles.Float, CultureInfo.InvariantCulture, out var quality))
                return quality;
        }

        return 1;
    }

    private static byte[] Compress(byte[] body, ContentEncoding encoding, int brotliQuality, CompressionLevel gzipLevel) {
        if (encoding == ContentEncoding.Brotli) {
            var buffer = new byte[BrotliEncoder.GetMaxCompressedLength(body.Length)];
            BrotliEncoder.TryCompress(body, buffer, out var written, brotliQuality, BrotliWindow);
            return buffer[..written];
        }

        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, gzipLevel, leaveOpen: true))
            gzip.Write(body);
        return output.ToArray();
    }

    private static bool IsCompressibleStatus(int status) => status is >= 200 and < 300 and not 204;

    private static string Token(ContentEncoding encoding) => encoding == ContentEncoding.Brotli ? "br" : "gzip";

    private static string SiblingExtension(ContentEncoding encoding) =>
        encoding == ContentEncoding.Brotli ? ".br" : ".gz";
}
