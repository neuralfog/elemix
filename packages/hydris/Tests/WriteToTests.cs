using System.IO.Pipelines;
using System.Text;
using Hydris.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Hydris.Tests;

public sealed class WriteToTests : IDisposable {
    private readonly string Dir = System.IO.Path.Combine(AppContext.BaseDirectory, "hydris-writeto-tests");

    public WriteToTests() => Directory.CreateDirectory(Dir);

    public void Dispose() {
        if (Directory.Exists(Dir))
            Directory.Delete(Dir, true);
    }

    private sealed class FakeResponse : IHttpResponseFeature {
        public int StatusCode { get; set; }
        public string? ReasonPhrase { get; set; }
        public IHeaderDictionary Headers { get; set; } = new HeaderDictionary();
        public Stream Body { get; set; } = Stream.Null;
        public bool HasStarted => false;
        public void OnStarting(Func<object, Task> callback, object state) { }
        public void OnCompleted(Func<object, Task> callback, object state) { }
    }

    private sealed class FakeBody : IHttpResponseBodyFeature {
        private PipeWriter? Cached;

        public MemoryStream Sink { get; } = new();
        public Stream Stream => Sink;
        public PipeWriter Writer => Cached ??= PipeWriter.Create(Sink);

        public Task SendFileAsync(string path, long offset, long? count, CancellationToken cancellationToken = default) {
            using var source = System.IO.File.OpenRead(path);
            source.CopyTo(Sink);
            return Task.CompletedTask;
        }

        public Task StartAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task CompleteAsync() => Task.CompletedTask;
        public void DisableBuffering() { }
    }

    private static async Task<byte[]> BodyBytes(FakeBody body) {
        await body.Writer.FlushAsync();
        return body.Sink.ToArray();
    }

    [Fact]
    public async Task HeadOnBytesSetsLengthWithoutBody() {
        var response = new FakeResponse();
        var body = new FakeBody();

        await Reply.Text("hello body").WriteTo(response, body, head: true, CancellationToken.None);

        Assert.Equal(10, response.Headers.ContentLength);
        Assert.Equal(0, body.Sink.Length);
    }

    [Fact]
    public async Task GetOnBytesWritesTheBody() {
        var response = new FakeResponse();
        var body = new FakeBody();

        await Reply.Text("hello body").WriteTo(response, body, head: false, CancellationToken.None);

        Assert.Equal(10, response.Headers.ContentLength);
        Assert.Equal("hello body", Encoding.UTF8.GetString(await BodyBytes(body)));
    }

    [Fact]
    public async Task HeadOnFileSetsLengthWithoutSending() {
        var path = System.IO.Path.Combine(Dir, "asset.txt");
        System.IO.File.WriteAllText(path, "file contents");
        var response = new FakeResponse();
        var body = new FakeBody();

        var reply = Reply.AssetFile(path, "text/plain", "etag", "no-cache", null, false);
        await reply.WriteTo(response, body, head: true, CancellationToken.None);

        Assert.Equal(13, response.Headers.ContentLength);
        Assert.Equal(0, body.Sink.Length);
    }

    [Fact]
    public async Task GetOnFileSendsContents() {
        var path = System.IO.Path.Combine(Dir, "asset.txt");
        System.IO.File.WriteAllText(path, "file contents");
        var response = new FakeResponse();
        var body = new FakeBody();

        var reply = Reply.AssetFile(path, "text/plain", "etag", "no-cache", null, false);
        await reply.WriteTo(response, body, head: false, CancellationToken.None);

        Assert.Equal(13, response.Headers.ContentLength);
        Assert.Equal("file contents", Encoding.UTF8.GetString(body.Sink.ToArray()));
    }
}
