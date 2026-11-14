using System.Buffers;
using System.Text;
using System.Text.Json;

namespace Hydris.Logging;

public sealed class DockerLoggerDriver : ILoggerDriver {
    public void Write(in LogEntry entry) {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer)) {
            writer.WriteStartObject();
            writer.WriteString("time", entry.Timestamp.UtcDateTime.ToString("O"));
            writer.WriteString("level", Level(entry.Level));
            writer.WriteString("message", entry.Message);
            if (entry.Error is not null)
                writer.WriteString("error", entry.Error.ToString());
            writer.WriteEndObject();
        }

        Console.Out.WriteLine(Encoding.UTF8.GetString(buffer.WrittenSpan));
    }

    private static string Level(LogLevel level) => level switch {
        LogLevel.Trace => "trace",
        LogLevel.Debug => "debug",
        LogLevel.Info => "info",
        LogLevel.Warn => "warn",
        LogLevel.Error => "error",
        LogLevel.Critical => "critical",
        _ => "info",
    };
}
