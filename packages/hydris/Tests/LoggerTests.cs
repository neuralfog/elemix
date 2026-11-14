using System.Net.Sockets;
using System.Text.Json;
using Hydris;
using Hydris.Logging;

namespace Hydris.Tests;

internal sealed class CapturingDriver : ILoggerDriver {
    public List<LogEntry> Entries { get; } = [];

    public void Write(in LogEntry entry) => Entries.Add(entry);
}

public sealed class LoggerTests {
    [Fact]
    public void ConvenienceMethodsSetLevel() {
        var driver = new CapturingDriver();
        var log = new Logger(driver, LogLevel.Trace);

        log.Trace("t");
        log.Debug("d");
        log.Info("i");
        log.Warn("w");
        log.Error("e");
        log.Critical("c");

        Assert.Equal(
            new[] {
                LogLevel.Trace, LogLevel.Debug, LogLevel.Info,
                LogLevel.Warn, LogLevel.Error, LogLevel.Critical,
            },
            driver.Entries.Select(e => e.Level));
    }

    [Fact]
    public void MinimumLevelFiltersBelow() {
        var driver = new CapturingDriver();
        var log = new Logger(driver, LogLevel.Warn);

        log.Debug("skip");
        log.Info("skip");
        log.Warn("keep");
        log.Error("keep");

        Assert.Equal(new[] { LogLevel.Warn, LogLevel.Error }, driver.Entries.Select(e => e.Level));
    }

    [Fact]
    public void ErrorCarriesException() {
        var driver = new CapturingDriver();
        var log = new Logger(driver);
        var ex = new InvalidOperationException("boom");

        log.Error("failed", ex);

        Assert.Equal("failed", driver.Entries[0].Message);
        Assert.Same(ex, driver.Entries[0].Error);
    }

    [Fact]
    public void DefaultLoggerUsesConsoleDriver() {
        var app = new App();
        var log = app.Container.Get<Logger>();
        Assert.IsType<ConsoleLoggerDriver>(log.Driver);
    }

    [Fact]
    public void AppLoggerSwapsTheDriver() {
        var driver = new CapturingDriver();
        var app = new App();
        app.Logger(driver);

        var log = app.Container.Get<Logger>();

        Assert.Same(driver, log.Driver);
        log.Info("hello");
        Assert.Single(driver.Entries);
    }

    [Fact]
    public void ReadyFallsThroughAsInfoLogByDefault() {
        var driver = new CapturingDriver();
        ((ILoggerDriver)driver).Ready(new ServerReady("0.1.0", "http", "localhost", 5000, 61, true));

        Assert.Single(driver.Entries);
        Assert.Equal(LogLevel.Info, driver.Entries[0].Level);
        Assert.Contains("http://localhost:5000/", driver.Entries[0].Message);
        Assert.Contains("0.1.0", driver.Entries[0].Message);
    }

    [Fact]
    public void MicrosoftLoggerBridgesToHydrisLogger() {
        var driver = new CapturingDriver();
        var provider = (Microsoft.Extensions.Logging.ILoggerProvider)
            new MicrosoftLoggerBridge(new Logger(driver, LogLevel.Trace));
        var mlog = provider.CreateLogger("Kestrel");

        Microsoft.Extensions.Logging.LoggerExtensions.LogWarning(mlog, "bind failed");

        Assert.Single(driver.Entries);
        Assert.Equal(LogLevel.Warn, driver.Entries[0].Level);
        Assert.Contains("Kestrel: bind failed", driver.Entries[0].Message);
    }
}

[CollectionDefinition("Console", DisableParallelization = true)]
public sealed class ConsoleCollection;

[Collection("Console")]
public sealed class LoggerDriverTests {
    private static (string Out, string Err) Capture(Action action) {
        var originalOut = Console.Out;
        var originalErr = Console.Error;
        var outWriter = new StringWriter();
        var errWriter = new StringWriter();
        Console.SetOut(outWriter);
        Console.SetError(errWriter);
        try {
            action();
        } finally {
            Console.SetOut(originalOut);
            Console.SetError(originalErr);
        }
        return (outWriter.ToString(), errWriter.ToString());
    }

    [Fact]
    public void DockerDriverWritesJsonLine() {
        var (stdout, _) = Capture(() =>
            new DockerLoggerDriver().Write(new LogEntry(LogLevel.Info, "hi", null, DateTimeOffset.UtcNow)));

        using var doc = JsonDocument.Parse(stdout.Trim());
        Assert.Equal("info", doc.RootElement.GetProperty("level").GetString());
        Assert.Equal("hi", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public void SystemdDriverFallsBackToPrefixedStdoutWithoutJournald() {
        var (stdout, _) = Capture(() =>
            new SystemdLoggerDriver("/nonexistent/hydris-journal.sock")
                .Write(new LogEntry(LogLevel.Error, "boom", null, DateTimeOffset.UtcNow)));

        Assert.StartsWith("<3>boom", stdout.Trim());
    }

    [Fact]
    public void ConsoleDriverRoutesErrorsToStderr() {
        var (stdout, stderr) = Capture(() => {
            var driver = new ConsoleLoggerDriver();
            driver.Write(new LogEntry(LogLevel.Info, "an-info", null, DateTimeOffset.UtcNow));
            driver.Write(new LogEntry(LogLevel.Error, "an-error", null, DateTimeOffset.UtcNow));
        });

        Assert.Contains("an-info", stdout);
        Assert.Contains("INFO", stdout);
        Assert.Contains("an-error", stderr);
        Assert.Contains("ERROR", stderr);
    }

    [Fact]
    public void SyslogFormatsRfc5424WithPriAndVersion() {
        var driver = new SyslogLoggerDriver((Socket?)null, SyslogFacility.User);
        var line = driver.Format(new LogEntry(LogLevel.Error, "db down", null, DateTimeOffset.UtcNow));
        Assert.StartsWith("<11>1 ", line);
        Assert.EndsWith("db down", line);
    }

    [Fact]
    public void SyslogFacilityComposesPri() {
        var driver = new SyslogLoggerDriver((Socket?)null, SyslogFacility.Local0);
        var line = driver.Format(new LogEntry(LogLevel.Info, "x", null, DateTimeOffset.UtcNow));
        Assert.StartsWith("<134>1 ", line);
    }

    [Fact]
    public void SyslogFallsBackToStdoutWithoutSink() {
        var (stdout, _) = Capture(() =>
            new SyslogLoggerDriver((Socket?)null, SyslogFacility.User)
                .Write(new LogEntry(LogLevel.Info, "noroute", null, DateTimeOffset.UtcNow)));

        Assert.Contains("noroute", stdout);
        Assert.Contains("INFO", stdout);
    }

    [Fact]
    public void ConsoleDriverRendersBannerForReady() {
        var (stdout, _) = Capture(() =>
            new ConsoleLoggerDriver().Ready(new ServerReady("0.1.0", "http", "localhost", 5000, 61, true)));

        Assert.Contains("hydris", stdout);
        Assert.Contains("http://localhost:5000/", stdout);
        Assert.Contains("ready in", stdout);
    }
}
