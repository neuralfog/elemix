namespace Hydris.Renderer;

public sealed class BunRenderer(Manager manager) : IRenderer {
    public ValueTask<byte[]> RenderAsync(string template, string args) =>
        new(manager.RenderAsync($"({template})(...{args})", CancellationToken.None));
}
