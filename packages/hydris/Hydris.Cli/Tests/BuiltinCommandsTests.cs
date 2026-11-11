using Hydris.Cli.Builtins;

namespace Hydris.Cli.Tests;

public sealed class BuiltinCommandsTests {
    [Fact]
    public void IsBuiltinRecognisesKnownNames() {
        Assert.True(BuiltinCommands.IsBuiltin("rm"));
        Assert.True(BuiltinCommands.IsBuiltin("cp"));
        Assert.True(BuiltinCommands.IsBuiltin("mkdir"));
        Assert.True(BuiltinCommands.IsBuiltin("mv"));
        Assert.True(BuiltinCommands.IsBuiltin("env"));
        Assert.False(BuiltinCommands.IsBuiltin("nope"));
    }

    [Fact]
    public void MkdirCreatesNestedDirectories() {
        var root = Directory.CreateTempSubdirectory("hcli-mkdir");
        try {
            var target = Path.Combine(root.FullName, "a", "b", "c");
            Assert.Equal(0, BuiltinCommands.Run("mkdir", ["-p", target]));
            Assert.True(Directory.Exists(target));
        } finally {
            root.Delete(true);
        }
    }

    [Fact]
    public void RmRemovesDirectoryRecursively() {
        var root = Directory.CreateTempSubdirectory("hcli-rm");
        try {
            var dir = Directory.CreateDirectory(Path.Combine(root.FullName, "x", "y")).FullName;
            File.WriteAllText(Path.Combine(dir, "f.txt"), "hi");
            Assert.Equal(0, BuiltinCommands.Run("rm", ["-rf", Path.Combine(root.FullName, "x")]));
            Assert.False(Directory.Exists(Path.Combine(root.FullName, "x")));
        } finally {
            root.Delete(true);
        }
    }

    [Fact]
    public void RmForceIgnoresMissing() {
        var missing = Path.Combine(Path.GetTempPath(), $"hcli-missing-{Guid.NewGuid()}");
        Assert.Equal(0, BuiltinCommands.Run("rm", ["-f", missing]));
    }

    [Fact]
    public void CpCopiesAFile() {
        var root = Directory.CreateTempSubdirectory("hcli-cp");
        try {
            var src = Path.Combine(root.FullName, "a.txt");
            File.WriteAllText(src, "data");
            var dst = Path.Combine(root.FullName, "b.txt");
            Assert.Equal(0, BuiltinCommands.Run("cp", [src, dst]));
            Assert.Equal("data", File.ReadAllText(dst));
        } finally {
            root.Delete(true);
        }
    }

    [Fact]
    public void MvMovesAFile() {
        var root = Directory.CreateTempSubdirectory("hcli-mv");
        try {
            var src = Path.Combine(root.FullName, "a.txt");
            File.WriteAllText(src, "data");
            var dst = Path.Combine(root.FullName, "b.txt");
            Assert.Equal(0, BuiltinCommands.Run("mv", [src, dst]));
            Assert.False(File.Exists(src));
            Assert.Equal("data", File.ReadAllText(dst));
        } finally {
            root.Delete(true);
        }
    }
}
