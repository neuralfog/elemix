using Hydris.Cli.Env;

namespace Hydris.Cli.Tests;

public sealed class EnvFileTests {
    [Fact]
    public void ParsePairSplitsKeyValue() {
        Assert.Equal("value", EnvFile.ParsePair("KEY=value")["KEY"]);
    }

    [Fact]
    public void ParsePairUnquotes() {
        Assert.Equal("a b", EnvFile.ParsePair("K=\"a b\"")["K"]);
        Assert.Equal("a b", EnvFile.ParsePair("K='a b'")["K"]);
    }

    [Fact]
    public void ParsePairIgnoresMalformed() {
        Assert.Empty(EnvFile.ParsePair("noequals"));
    }

    [Fact]
    public void ParseFileHandlesCommentsExportAndQuotes() {
        var path = Path.GetTempFileName();
        File.WriteAllText(path, "# a comment\nexport FOO=bar\nBAZ=\"q u x\"\n\nBAD LINE\nK = spaced \n");
        try {
            var env = EnvFile.Parse(path);
            Assert.Equal("bar", env["FOO"]);
            Assert.Equal("q u x", env["BAZ"]);
            Assert.Equal("spaced", env["K"]);
            Assert.False(env.ContainsKey("BAD LINE"));
        } finally {
            File.Delete(path);
        }
    }
}
