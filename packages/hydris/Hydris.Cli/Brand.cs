using System.Text;

namespace Hydris.Cli;

public static class Brand {
    private static readonly bool NoColor =
        Console.IsOutputRedirected || Environment.GetEnvironmentVariable("NO_COLOR") is not null;

    public static bool ColorEnabled => !NoColor;

    private static readonly string VersionText =
        typeof(Brand).Assembly.GetName().Version?.ToString(3) ?? string.Empty;

    private static readonly string Bar = Violet("▐▌");
    private static readonly string Arrow = Violet("➜");

    public static void Banner() {
        var builder = new StringBuilder();
        builder.Append('\n');
        builder.Append($"  {Bar}  {Bold("elemix")} {Dim("·")} {Dim("hydris")}\n");
        builder.Append($"  {Bar}  {Dim($"v{VersionText}")}  {Dim("·")}  {Dim("cli")}\n");
        builder.Append('\n');
        Console.Write(builder.ToString());
    }

    public static void Info(string message) => Console.WriteLine($"  {Dim(message)}");

    public static void Blank() => Console.WriteLine();

    public static void Error(string message) => Console.Error.WriteLine($"  {Bar}  {message}");

    public static void TaskLine(string name, string? desc) {
        if (string.IsNullOrEmpty(desc))
            Console.WriteLine($"  {Arrow}  {Bold(name)}");
        else
            Console.WriteLine($"  {Arrow}  {Bold(name.PadRight(16))}{Dim(desc)}");
    }

    public static void Running(string name) => Console.WriteLine($"  {Arrow}  {Dim("run")} {Bold(name)}");

    public static void TaskBlockStart(string name, string command) {
        Console.Out.Write($"{Cyan(name)}{Dim("$")} {Dim(command)}\n{Dim("│")}\n");
        Console.Out.Flush();
    }

    public static void TaskBlockLine(string line) => Console.Out.WriteLine($"{Dim("│")} {line}");

    public static void Spinner(string frame) {
        Console.Out.Write($"\r{Dim($"{frame} Running...")}");
        Console.Out.Flush();
    }

    public static void SpinnerClear() {
        Console.Out.Write("\r\x1b[2K");
        Console.Out.Flush();
    }

    public static void TaskBlockEnd(int exitCode, long elapsedMs, bool hadOutput) {
        var status = exitCode == 0
            ? Green($"Done in {elapsedMs}ms")
            : Amber($"Failed (exit {exitCode}) in {elapsedMs}ms");
        var lead = hadOutput ? $"{Dim("│")}\n" : "";
        Console.Out.Write($"{lead}{Dim("└─")} {status}\n\n");
    }

    public static string Violet(string text) => Paint("38;2;167;139;250", text);

    public static string Cyan(string text) => Paint("38;2;34;211;238", text);

    public static string Dim(string text) => Paint("38;2;110;118;129", text);

    public static string Bold(string text) => Paint("1", text);

    public static string Green(string text) => Paint("38;2;74;222;128", text);

    public static string Amber(string text) => Paint("38;2;251;146;60", text);

    private static string Paint(string code, string text) =>
        NoColor ? text : $"\x1b[{code}m{text}\x1b[0m";
}
