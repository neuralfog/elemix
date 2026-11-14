namespace Hydris.Logging;

public sealed class Logger(ILoggerDriver driver, LogLevel minimum = LogLevel.Info) {
    public LogLevel Minimum { get; } = minimum;

    public ILoggerDriver Driver { get; } = driver;

    public void Trace(string message) => Emit(LogLevel.Trace, message, null);

    public void Debug(string message) => Emit(LogLevel.Debug, message, null);

    public void Info(string message) => Emit(LogLevel.Info, message, null);

    public void Warn(string message) => Emit(LogLevel.Warn, message, null);

    public void Error(string message, Exception? error = null) => Emit(LogLevel.Error, message, error);

    public void Critical(string message, Exception? error = null) => Emit(LogLevel.Critical, message, error);

    public void Log(LogLevel level, string message, Exception? error = null) => Emit(level, message, error);

    public void Ready(in ServerReady ready) {
        if (LogLevel.Info >= Minimum)
            Driver.Ready(ready);
    }

    private void Emit(LogLevel level, string message, Exception? error) {
        if (level < Minimum)
            return;
        Driver.Write(new LogEntry(level, message, error, DateTimeOffset.UtcNow));
    }
}
