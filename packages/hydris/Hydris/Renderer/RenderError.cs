using System.Text;

namespace Hydris.Renderer;

internal static class RenderError {
    private static ReadOnlySpan<byte> Prefix => "ERROR:"u8;

    internal static bool TryRead(ReadOnlySpan<byte> rendered, out string message) {
        if (rendered.StartsWith(Prefix)) {
            message = Encoding.UTF8.GetString(rendered[Prefix.Length..]);
            return true;
        }

        message = string.Empty;
        return false;
    }
}
