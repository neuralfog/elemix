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

    [Fact]
    public void LoadDirectoryReadsDotEnv() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, ".env"), "FOO=bar\n");
            Assert.Equal("bar", EnvFile.LoadDirectory(dir)["FOO"]);
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadDirectoryReadsAnyStarDotEnvFile() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, "service.env"), "A=1\n");
            Assert.Equal("1", EnvFile.LoadDirectory(dir)["A"]);
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadDirectoryMergesAllEnvFilesLaterNameWins() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, ".env"), "SHARED=base\nONLY_BASE=x\n");
            File.WriteAllText(Path.Combine(dir, "z-override.env"), "SHARED=override\nONLY_Z=y\n");
            var env = EnvFile.LoadDirectory(dir);
            Assert.Equal("override", env["SHARED"]);
            Assert.Equal("x", env["ONLY_BASE"]);
            Assert.Equal("y", env["ONLY_Z"]);
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadDirectoryIgnoresNonEnvFiles() {
        var dir = Directory.CreateTempSubdirectory().FullName;
        try {
            File.WriteAllText(Path.Combine(dir, "notes.txt"), "SKIP=1\n");
            File.WriteAllText(Path.Combine(dir, ".env.local"), "ALSO_SKIP=1\n");
            var env = EnvFile.LoadDirectory(dir);
            Assert.False(env.ContainsKey("SKIP"));
            Assert.False(env.ContainsKey("ALSO_SKIP"));
        } finally {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadDirectoryEmptyForMissingDirectory() {
        Assert.Empty(EnvFile.LoadDirectory(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"))));
    }
}
