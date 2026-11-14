namespace Hydris.Logging;

public readonly record struct LogEntry(
    LogLevel Level,
    string Message,
    Exception? Error,
    DateTimeOffset Timestamp);

public readonly record struct ServerReady(
    string Version,
    string Protocol,
    string Host,
    int Port,
    long ElapsedMs,
    bool Development) {
    public string Line =>
        $"hydris v{Version} listening on {Protocol}://{Host}:{Port}/ (ready in {ElapsedMs}ms, {(Development ? "development" : "production")})";
}

public interface ILoggerDriver {
    void Write(in LogEntry entry);

    void Ready(in ServerReady ready) =>
        Write(new LogEntry(LogLevel.Info, ready.Line, null, DateTimeOffset.UtcNow));
}
