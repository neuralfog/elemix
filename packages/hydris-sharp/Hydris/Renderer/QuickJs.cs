using System.Runtime.InteropServices;

namespace Hydris.Renderer;

internal static partial class QuickJs {
    private const string Lib = "hydrisqjs";

    [LibraryImport(Lib, EntryPoint = "hq_new")]
    internal static partial IntPtr New();

    [LibraryImport(Lib, EntryPoint = "hq_compile", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial IntPtr Compile(IntPtr engine, string template);

    [LibraryImport(Lib, EntryPoint = "hq_call", StringMarshalling = StringMarshalling.Utf8)]
    internal static partial IntPtr Call(IntPtr engine, IntPtr function, string argsJson, out int length);

    [LibraryImport(Lib, EntryPoint = "hq_free_fn")]
    internal static partial void FreeFunction(IntPtr engine, IntPtr function);

    [LibraryImport(Lib, EntryPoint = "hq_memory")]
    internal static partial long Memory(IntPtr engine);

    [LibraryImport(Lib, EntryPoint = "hq_free")]
    internal static partial void FreeString(IntPtr text);

    [LibraryImport(Lib, EntryPoint = "hq_close")]
    internal static partial void Close(IntPtr engine);
}
