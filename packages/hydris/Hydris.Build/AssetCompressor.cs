using System.IO;
using System.IO.Compression;

namespace Hydris.Build;

internal readonly record struct CompressResult(long Raw, long Brotli, long Gzip);

internal static class AssetCompressor {
    private const int BrotliQuality = 11;
    private const int BrotliWindow = 24;

    internal static CompressResult Compress(string path) {
        var raw = File.ReadAllBytes(path);
        var brotli = ToBrotli(raw);
        var gzip = ToGzip(raw);
        File.WriteAllBytes(path + ".br", brotli);
        File.WriteAllBytes(path + ".gz", gzip);
        return new CompressResult(raw.Length, brotli.Length, gzip.Length);
    }

    private static byte[] ToBrotli(byte[] body) {
        var buffer = new byte[BrotliEncoder.GetMaxCompressedLength(body.Length)];
        BrotliEncoder.TryCompress(body, buffer, out var written, BrotliQuality, BrotliWindow);
        return buffer[..written];
    }

    private static byte[] ToGzip(byte[] body) {
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.SmallestSize, leaveOpen: true))
            gzip.Write(body);
        return output.ToArray();
    }
}
