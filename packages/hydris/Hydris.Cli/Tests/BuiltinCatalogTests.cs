using Hydris.Cli.Builtins;

namespace Hydris.Cli.Tests;

public sealed class BuiltinCatalogTests {
    [Fact]
    public void ListsRoutesAsABuiltin() =>
        Assert.Contains(BuiltinCatalog.All, c => c.Usage == "routes");

    [Fact]
    public void EveryBuiltinHasUsageAndDescription() =>
        Assert.All(BuiltinCatalog.All, c => {
            Assert.False(string.IsNullOrWhiteSpace(c.Usage));
            Assert.False(string.IsNullOrWhiteSpace(c.Description));
        });
}
