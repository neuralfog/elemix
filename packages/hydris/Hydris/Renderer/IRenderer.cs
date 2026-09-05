namespace Hydris.Renderer;

public interface IRenderer {
    byte[] Render(string key, byte[] bytecode, string? data);
}
