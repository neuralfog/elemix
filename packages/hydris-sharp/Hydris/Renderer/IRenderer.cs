namespace Hydris.Renderer;

public interface IRenderer {
    ValueTask<byte[]> RenderAsync(string template, string args);
}
