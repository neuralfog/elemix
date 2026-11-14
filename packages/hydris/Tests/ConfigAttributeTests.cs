using Hydris;
using Hydris.Container;

namespace Hydris.Tests;

[Config]
public sealed record WidgetConfig {
    public string Label { get; } = Env.Get("HYDRIS_TEST_WIDGET_LABEL", "widget");
}

public sealed class ConfigAttributeTests {
    [Fact]
    public void ConfigTypeIsRegisteredAsSingleton() {
        var app = new App();
        var first = app.Container.Get<WidgetConfig>();
        var second = app.Container.Get<WidgetConfig>();

        Assert.Same(first, second);
        Assert.Equal("widget", first.Label);
    }
}
