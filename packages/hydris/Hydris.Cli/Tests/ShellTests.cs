using Hydris.Cli.Exec;

namespace Hydris.Cli.Tests;

public sealed class ShellTests {
    [Fact]
    public void DefaultUsesSystemShell() {
        var inv = Shell.Resolve(null, "echo hi");
        Assert.Equal("/bin/sh", inv.File);
        Assert.Equal(new[] { "-c", "echo hi" }, inv.Args);
    }

    [Fact]
    public void BlankShellIsTreatedAsDefault() {
        Assert.Equal("/bin/sh", Shell.Resolve("", "x").File);
    }

    [Theory]
    [InlineData("bash", "-c")]
    [InlineData("sh", "-c")]
    [InlineData("zsh", "-c")]
    [InlineData("python", "-c")]
    [InlineData("python3", "-c")]
    [InlineData("node", "-e")]
    public void NamedShellMapsToItsFlag(string shell, string flag) {
        var inv = Shell.Resolve(shell, "x");
        Assert.Equal(shell, inv.File);
        Assert.Equal(flag, inv.Args[0]);
        Assert.Equal("x", inv.Args[^1]);
    }

    [Fact]
    public void PowershellUsesCommandFlag() {
        var inv = Shell.Resolve("pwsh", "x");
        Assert.Equal("pwsh", inv.File);
        Assert.Contains("-Command", inv.Args);
        Assert.Equal("x", inv.Args[^1]);
    }

    [Fact]
    public void UnknownShellFallsBackToDashC() {
        var inv = Shell.Resolve("myshell", "x");
        Assert.Equal("myshell", inv.File);
        Assert.Equal(new[] { "-c", "x" }, inv.Args);
    }
}
