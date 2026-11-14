using System.Globalization;

namespace Hydris.Logging;

public static class LogFormat {
    public static string Line(in LogEntry entry) {
        var time = entry.Timestamp.UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
        var line = $"{time} {Label(entry.Level)} {entry.Message}";
        return entry.Error is null ? line : $"{line}\n{entry.Error}";
    }

    public static string Label(LogLevel level) => level switch {
        LogLevel.Trace => "TRACE",
        LogLevel.Debug => "DEBUG",
        LogLevel.Info => "INFO",
        LogLevel.Warn => "WARN",
        LogLevel.Error => "ERROR",
        LogLevel.Critical => "CRITICAL",
        _ => "LOG",
    };

    public static int Severity(LogLevel level) => level switch {
        LogLevel.Trace or LogLevel.Debug => 7,
        LogLevel.Info => 6,
        LogLevel.Warn => 4,
        LogLevel.Error => 3,
        LogLevel.Critical => 2,
        _ => 6,
    };
}
