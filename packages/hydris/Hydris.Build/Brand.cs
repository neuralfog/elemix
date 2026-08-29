using System.Text;

namespace Hydris.Build;

internal static class Brand {
    private static readonly bool NoColor =
        Console.IsOutputRedirected || Environment.GetEnvironmentVariable("NO_COLOR") is not null;

    private static readonly string Version =
        typeof(Brand).Assembly.GetName().Version?.ToString(3) ?? string.Empty;

    private static readonly string Bar = Violet("▐▌");

    internal static void Banner() {
        var builder = new StringBuilder();
        builder.Append('\n');
        builder.Append($"  {Bar}  {Bold("elemix")} {Dim("·")} {Dim("hydris")}\n");
        builder.Append($"  {Bar}  {Dim($"v{Version}")}  {Dim("·")}  {Dim("build")}\n");
        builder.Append('\n');
        Console.Write(builder.ToString());
    }

    internal static void Info(string message) => Console.WriteLine($"  {Dim(message)}");

    internal static void Blank() => Console.WriteLine();

    internal static void Bytecode(string path, long size) =>
        Console.WriteLine($"  {Green("[bytecode]")} {Dim(path)}  {Dim(Size(size))}");

    internal static void Compress(string path, long raw, long compressed) =>
        Console.WriteLine($"  {Amber("[compress]")} {Dim(path)}  {Dim($"{Size(raw)} → ")}{Amber(Size(compressed))}");

    internal static void Summary(int views, int optimised, int hydrate, int bytecode, long compressedFrom, long compressedTo) {
        var builder = new StringBuilder();
        builder.Append('\n');
        builder.Append($"  {Gradient(new string('─', 54))}\n");
        builder.Append($"   {Paint("1;38;2;74;222;128", "✓ build complete")}");
        builder.Append($"    {Dim($"◆ {views} view{Plural(views)}")}");
        if (optimised >= 0)
            builder.Append($"    {Dim($"◈ {optimised} optimised")}");
        builder.Append($"    {Dim($"◇ {hydrate} hydration bundle{Plural(hydrate)}")}");
        builder.Append($"    {Dim($"▣ {bytecode} bytecode")}");
        if (compressedFrom > 0)
            builder.Append($"    {Dim($"▤ {Size(compressedFrom)} → {Size(compressedTo)}")}");
        builder.Append("\n\n");
        Console.Write(builder.ToString());
    }

    internal static void Error(string message) => Console.Error.WriteLine($"  {Bar}  {message}");

    private static string Paint(string code, string text) =>
        NoColor ? text : $"\x1b[{code}m{text}\x1b[0m";

    private static string Violet(string text) => Paint("38;2;167;139;250", text);

    private static string Dim(string text) => Paint("38;2;110;118;129", text);

    private static string Bold(string text) => Paint("1", text);

    private static string Green(string text) => Paint("38;2;74;222;128", text);

    private static string Amber(string text) => Paint("38;2;251;146;60", text);

    private static string Size(long bytes) {
        if (bytes < 1024)
            return $"{bytes} B";
        var kb = bytes / 1024.0;
        return kb < 1024 ? $"{kb:0.0} KB" : $"{kb / 1024:0.0} MB";
    }

    private static string Gradient(string text) {
        if (NoColor)
            return text;
        (int R, int G, int B) from = (167, 139, 250);
        (int R, int G, int B) to = (34, 211, 238);
        var chars = text.ToCharArray();
        var last = Math.Max(chars.Length - 1, 1);
        var builder = new StringBuilder();
        for (var i = 0; i < chars.Length; i++) {
            var t = (double)i / last;
            var r = (int)Math.Round(from.R + (to.R - from.R) * t);
            var g = (int)Math.Round(from.G + (to.G - from.G) * t);
            var b = (int)Math.Round(from.B + (to.B - from.B) * t);
            builder.Append($"\x1b[38;2;{r};{g};{b}m").Append(chars[i]);
        }

        builder.Append("\x1b[0m");
        return builder.ToString();
    }

    private static string Plural(int n) => n == 1 ? "" : "s";
}
