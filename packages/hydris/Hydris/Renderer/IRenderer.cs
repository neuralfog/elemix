namespace Hydris.Renderer;

public interface IRenderer {
    byte[] Render(string bundlePath, string? data);
}
