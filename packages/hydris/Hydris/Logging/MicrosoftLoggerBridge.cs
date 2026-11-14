namespace Hydris.Logging;

internal sealed class MicrosoftLoggerBridge(Logger logger) : Microsoft.Extensions.Logging.ILoggerProvider {
    public Microsoft.Extensions.Logging.ILogger CreateLogger(string categoryName) =>
        new Adapter(logger, categoryName);

    public void Dispose() { }

    private sealed class Adapter(Logger logger, string category) : Microsoft.Extensions.Logging.ILogger {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) =>
            logLevel != Microsoft.Extensions.Logging.LogLevel.None;

        public void Log<TState>(
            Microsoft.Extensions.Logging.LogLevel logLevel,
            Microsoft.Extensions.Logging.EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) {
            if (logLevel == Microsoft.Extensions.Logging.LogLevel.None)
                return;
            logger.Log(Map(logLevel), $"{category}: {formatter(state, exception)}", exception);
        }

        private static LogLevel Map(Microsoft.Extensions.Logging.LogLevel level) => level switch {
            Microsoft.Extensions.Logging.LogLevel.Trace => LogLevel.Trace,
            Microsoft.Extensions.Logging.LogLevel.Debug => LogLevel.Debug,
            Microsoft.Extensions.Logging.LogLevel.Information => LogLevel.Info,
            Microsoft.Extensions.Logging.LogLevel.Warning => LogLevel.Warn,
            Microsoft.Extensions.Logging.LogLevel.Error => LogLevel.Error,
            Microsoft.Extensions.Logging.LogLevel.Critical => LogLevel.Critical,
            _ => LogLevel.Info,
        };
    }
}
