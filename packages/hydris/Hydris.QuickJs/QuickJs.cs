using System.Runtime.InteropServices;

namespace Hydris.QuickJs;

internal static partial class QuickJs {
    private const string Lib = "hydrisqjs";

    [LibraryImport(Lib, EntryPoint = "hq_new")]
    internal static partial IntPtr New();

    [LibraryImport(Lib, EntryPoint = "hq_bytecode", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial IntPtr Bytecode(IntPtr engine, string bundle, out int length);

    [LibraryImport(Lib, EntryPoint = "hq_load_bytecode")]
    internal static partial IntPtr LoadBytecode(IntPtr engine, byte[] bytecode, int length);

    [LibraryImport(Lib, EntryPoint = "hq_render", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial IntPtr Render(IntPtr engine, string data, out int length);

    [LibraryImport(Lib, EntryPoint = "hq_free")]
    internal static partial void FreeString(IntPtr text);

    [LibraryImport(Lib, EntryPoint = "hq_close")]
    internal static partial void Close(IntPtr engine);
}
