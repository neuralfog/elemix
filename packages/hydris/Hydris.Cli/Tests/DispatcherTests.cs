namespace Hydris.Cli.Tests;

public sealed class DispatcherTests {
    [Fact]
    public void BareBuiltinWithTaskRunsTask() {
        Assert.True(Dispatcher.ShouldRunTask("watch", 0, true));
        Assert.True(Dispatcher.ShouldRunTask("build", 0, true));
    }

    [Fact]
    public void BuiltinWithArgsRunsBuiltinEvenWhenTaskExists() {
        Assert.False(Dispatcher.ShouldRunTask("watch", 4, true));
        Assert.False(Dispatcher.ShouldRunTask("build", 1, true));
    }

    [Fact]
    public void BareBuiltinWithoutTaskRunsBuiltin() {
        Assert.False(Dispatcher.ShouldRunTask("watch", 0, false));
        Assert.False(Dispatcher.ShouldRunTask("env", 0, false));
    }

    [Fact]
    public void NonBuiltinAlwaysRunsTask() {
        Assert.True(Dispatcher.ShouldRunTask("dev", 0, true));
        Assert.True(Dispatcher.ShouldRunTask("deploy", 2, true));
        Assert.True(Dispatcher.ShouldRunTask("unknown", 0, false));
    }
}
