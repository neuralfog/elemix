using Hydris.Cli;

namespace Hydris.Logging;

public sealed class ConsoleLoggerDriver : ILoggerDriver {
    public void Write(in LogEntry entry) {
        var writer = entry.Level >= LogLevel.Error ? Console.Error : Console.Out;
        writer.WriteLine(LogFormat.Line(entry));
    }

    public void Ready(in ServerReady ready) =>
        Console.Write(Banner.Serve(new BannerInfo {
            Host = ready.Host,
            Port = ready.Port,
            Protocol = ready.Protocol,
            Dev = ready.Development,
            Ms = ready.ElapsedMs,
        }));
}
