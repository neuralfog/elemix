using System.Text;

namespace Hydris.Cli;

public sealed class BannerInfo {
    public string Host { get; init; } = "localhost";
    public int Port { get; init; }
    public string Protocol { get; init; } = "http";
    public bool Dev { get; init; }
    public long Ms { get; init; }
    public int Renderers { get; init; }
}

public static class Banner {
    private static readonly bool NoColor =
        Console.IsOutputRedirected || Environment.GetEnvironmentVariable("NO_COLOR") is not null;

    private static readonly string Version =
        typeof(Banner).Assembly.GetName().Version?.ToString(3) ?? string.Empty;

    private static readonly string Bar = Violet("▐▌");
    private static readonly string Arrow = Violet("➜");

    public static string Info(string message) => $"  {Bar}  {Dim(message)}";

    public static string Serve(BannerInfo info) {
        ArgumentNullException.ThrowIfNull(info);

        var local = $"{info.Protocol}://{info.Host}:{info.Port}/";
        var mode = info.Dev ? Cyan("development") : Violet("production");

        var builder = new StringBuilder();
        builder.Append('\n');
        builder.Append($"  {Bar}  {Bold("elemix")} {Dim("·")} {Dim("hydris")}\n");
        builder.Append($"  {Bar}  {Dim($"v{Version}")}  {Dim("ready in")} {Bold(info.Ms.ToString())} {Dim("ms")}  {Dim("·")}  {mode}\n");
        builder.Append('\n');
        builder.Append($"  {Arrow}  {Label("Local:")}{Cyan(local)}\n");
        builder.Append($"  {Arrow}  {Label("Renderers:")}{Bold(info.Renderers.ToString())}\n");
        builder.Append('\n');
        return builder.ToString();
    }

    private static string Label(string text) => Dim(text.PadRight(11));

    private static string Paint(string code, string text) =>
        NoColor ? text : $"\x1b[{code}m{text}\x1b[0m";

    private static string Violet(string text) => Paint("38;2;167;139;250", text);
    private static string Cyan(string text) => Paint("38;2;34;211;238", text);
    private static string Dim(string text) => Paint("38;2;110;118;129", text);
    private static string Bold(string text) => Paint("1", text);
}
