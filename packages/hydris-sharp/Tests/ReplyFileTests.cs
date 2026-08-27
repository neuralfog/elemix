using Hydris.Error;
using Hydris.Http;

namespace Hydris.Tests;

public sealed class ReplyFileTests : IDisposable {
    private readonly string Dir = System.IO.Path.Combine(AppContext.BaseDirectory, "hydris-test-assets");

    public ReplyFileTests() => Directory.CreateDirectory(Dir);

    public void Dispose() {
        if (Directory.Exists(Dir))
            Directory.Delete(Dir, true);
    }

    private string Make(string name, byte[]? data = null) {
        var path = System.IO.Path.Combine(Dir, name);
        System.IO.File.WriteAllBytes(path, data ?? [1, 2, 3]);
        return path;
    }

    [Fact]
    public void BinaryIsOctetStreamWithRawBytes() {
        var bytes = new byte[] { 1, 2, 3, 4, 5 };
        var reply = Reply.Binary(bytes);

        Assert.Equal(200, reply.StatusCode);
        Assert.Equal("application/octet-stream", reply.HeaderValue("Content-Type"));
        Assert.Equal(bytes, reply.Content);
    }

    [Fact]
    public void FileGuessesContentTypeFromExtension() {
        var reply = Reply.File(Make("daily.pdf"));

        Assert.Equal(200, reply.StatusCode);
        Assert.Equal("application/pdf", reply.HeaderValue("Content-Type"));
        Assert.Null(reply.HeaderValue("Content-Disposition"));
    }

    [Fact]
    public void FileResolvesRelativeToBaseDirectory() {
        Make("song.mp3");
        var reply = Reply.File("hydris-test-assets/song.mp3");

        Assert.Equal("audio/mpeg", reply.HeaderValue("Content-Type"));
    }

    [Fact]
    public void UnknownExtensionFallsBackToOctetStream() {
        var reply = Reply.File(Make("data.xyz"));

        Assert.Equal("application/octet-stream", reply.HeaderValue("Content-Type"));
    }

    [Fact]
    public void FileDownloadSetsAttachmentDisposition() {
        var reply = Reply.FileDownload(Make("nice.mp3"), "name-nice.mp3");

        var disposition = reply.HeaderValue("Content-Disposition");
        Assert.Contains("attachment", disposition);
        Assert.Contains("filename=\"name-nice.mp3\"", disposition);
    }

    [Fact]
    public void FileDownloadDefaultsToTheFileName() {
        var reply = Reply.FileDownload(Make("report.pdf"));

        Assert.Contains("filename=\"report.pdf\"", reply.HeaderValue("Content-Disposition"));
    }

    [Fact]
    public void MissingFileThrowsNotFound() {
        Assert.Throws<NotFoundException>(() => Reply.File(System.IO.Path.Combine(Dir, "nope.pdf")));
    }
}
