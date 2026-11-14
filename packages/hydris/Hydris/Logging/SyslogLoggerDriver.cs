using System.Buffers;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace Hydris.Logging;

public enum SyslogFacility {
    Kernel = 0,
    User = 1,
    Mail = 2,
    Daemon = 3,
    Auth = 4,
    Syslog = 5,
    Lpr = 6,
    News = 7,
    Uucp = 8,
    Cron = 9,
    AuthPriv = 10,
    Ftp = 11,
    Local0 = 16,
    Local1 = 17,
    Local2 = 18,
    Local3 = 19,
    Local4 = 20,
    Local5 = 21,
    Local6 = 22,
    Local7 = 23,
}

public sealed class SyslogLoggerDriver : ILoggerDriver, IDisposable {
    private const string DefaultSocketPath = "/dev/log";

    private static readonly byte[] Bom = [0xEF, 0xBB, 0xBF];

    private readonly Socket? Transport;
    private readonly SyslogFacility Facility;
    private readonly string Host;
    private readonly string App;
    private readonly int ProcessId;

    public SyslogLoggerDriver(SyslogFacility facility = SyslogFacility.User)
        : this(ConnectUnix(DefaultSocketPath), facility) { }

    public SyslogLoggerDriver(string host, int port = 514, SyslogFacility facility = SyslogFacility.User)
        : this(ConnectUdp(host, port), facility) { }

    internal SyslogLoggerDriver(Socket? transport, SyslogFacility facility) {
        Transport = transport;
        Facility = facility;
        Host = Sanitize(Environment.MachineName, 255);
        App = Sanitize(AppName(), 48);
        ProcessId = Environment.ProcessId;
    }

    public void Write(in LogEntry entry) {
        if (Transport is not null && TrySend(entry))
            return;
        Console.Out.WriteLine(LogFormat.Line(entry));
    }

    public void Dispose() => Transport?.Dispose();

    internal string Format(in LogEntry entry) => Prefix(entry) + Flatten(entry);

    private bool TrySend(in LogEntry entry) {
        try {
            Transport!.Send(Serialize(entry));
            return true;
        } catch {
            return false;
        }
    }

    private byte[] Serialize(in LogEntry entry) {
        var buffer = new ArrayBufferWriter<byte>();
        Append(buffer, Prefix(entry));
        buffer.Write(Bom);
        Append(buffer, Flatten(entry));
        return buffer.WrittenSpan.ToArray();
    }

    private string Prefix(in LogEntry entry) {
        var pri = ((int)Facility * 8) + LogFormat.Severity(entry.Level);
        var time = entry.Timestamp.ToString("yyyy-MM-dd'T'HH:mm:ss.ffffffzzz", CultureInfo.InvariantCulture);
        return $"<{pri.ToString(CultureInfo.InvariantCulture)}>1 {time} {Host} {App} {ProcessId.ToString(CultureInfo.InvariantCulture)} - - ";
    }

    private static string Flatten(in LogEntry entry) {
        var text = entry.Error is null ? entry.Message : $"{entry.Message} {entry.Error}";
        return text.Replace('\n', ' ').Replace('\r', ' ');
    }

    private static Socket? ConnectUnix(string path) {
        if (!File.Exists(path))
            return null;
        try {
            var socket = new Socket(AddressFamily.Unix, SocketType.Dgram, ProtocolType.Unspecified);
            socket.Connect(new UnixDomainSocketEndPoint(path));
            return socket;
        } catch {
            return null;
        }
    }

    private static Socket? ConnectUdp(string host, int port) {
        try {
            var addresses = Dns.GetHostAddresses(host);
            if (addresses.Length == 0)
                return null;
            var socket = new Socket(addresses[0].AddressFamily, SocketType.Dgram, ProtocolType.Udp);
            socket.Connect(new IPEndPoint(addresses[0], port));
            return socket;
        } catch {
            return null;
        }
    }

    private static void Append(ArrayBufferWriter<byte> buffer, string text) {
        var span = buffer.GetSpan(Encoding.UTF8.GetByteCount(text));
        buffer.Advance(Encoding.UTF8.GetBytes(text, span));
    }

    private static string AppName() {
        var path = Environment.ProcessPath;
        return string.IsNullOrEmpty(path) ? "-" : Path.GetFileNameWithoutExtension(path);
    }

    private static string Sanitize(string value, int max) {
        if (string.IsNullOrEmpty(value))
            return "-";
        var builder = new StringBuilder();
        foreach (var c in value) {
            if (builder.Length >= max)
                break;
            builder.Append(c is >= '!' and <= '~' ? c : '_');
        }
        return builder.Length == 0 ? "-" : builder.ToString();
    }
}
