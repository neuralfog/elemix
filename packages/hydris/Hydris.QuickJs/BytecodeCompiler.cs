using System.Runtime.InteropServices;

namespace Hydris.QuickJs;

internal static class BytecodeCompiler {
    internal static byte[] Compile(string source) {
        // @Todo
        // This is to much, change a code style, this is unnesescary runtime check
        // only handle nulls if type is actually nullable
        // otherwise use debug asserts to catch invariants early
        ArgumentNullException.ThrowIfNull(source);
        var engine = QuickJs.New();
        try {
            var pointer = QuickJs.Bytecode(engine, source, out var length);
            if (pointer == IntPtr.Zero)
                throw new InvalidOperationException("bytecode compile failed");
            var bytecode = new byte[length];
            Marshal.Copy(pointer, bytecode, 0, length);
            QuickJs.FreeString(pointer);
            return bytecode;
        } finally {
            QuickJs.Close(engine);
        }
    }
}
