using Hydris.Container;
using Hydris.Core;
using Hydris.Http;

namespace Hydris.Tests;

public sealed class ElemixManifestTests : IDisposable {
    private readonly string Dir = System.IO.Path.Combine(AppContext.BaseDirectory, "hydris-manifest-tests");

    public ElemixManifestTests() => Directory.CreateDirectory(Dir);

    public void Dispose() {
        if (Directory.Exists(Dir))
            Directory.Delete(Dir, true);
    }

    private string Write(string json) {
        var path = System.IO.Path.Combine(Dir, "manifest.json");
        System.IO.File.WriteAllText(path, json);
        return path;
    }

    [Fact]
    public void ResolvesLogicalNamesToHashedFiles() {
        var manifest = ElemixManifest.Load(
            Write("{\"home\":\"home-a1b2c3.js\",\"about\":\"about-d4e5f6.js\"}"));

        Assert.Equal("home-a1b2c3.js", manifest.Resolve("home"));
        Assert.Equal("about-d4e5f6.js", manifest.Resolve("about"));
    }

    [Fact]
    public void UnknownNameResolvesToNull() {
        var manifest = ElemixManifest.Load(Write("{\"home\":\"home-a1b2c3.js\"}"));

        Assert.Null(manifest.Resolve("missing"));
    }

    [Fact]
    public void MissingManifestFileLoadsEmpty() {
        var manifest = ElemixManifest.Load(System.IO.Path.Combine(Dir, "does-not-exist.json"));

        Assert.Null(manifest.Resolve("home"));
    }

    [Fact]
    public void CoreServiceProviderRegistersTheManifestAsASingleton() {
        var container = new DiContainer();
        new CoreServiceProvider().Register(container);
        container.Start();

        Assert.NotNull(container.Get<ElemixManifest>());
    }
}
