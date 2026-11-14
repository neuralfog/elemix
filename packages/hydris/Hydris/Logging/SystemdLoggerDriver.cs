using System.Buffers;
using System.Buffers.Binary;
using System.Globalization;
using System.IO;
using System.Net.Sockets;
using System.Text;

namespace Hydris.Logging;

public sealed class SystemdLoggerDriver : ILoggerDriver, IDisposable {
    private const string DefaultSocketPath = "/run/systemd/journal/socket";

    private readonly Socket? Journal;

    public SystemdLoggerDriver() : this(DefaultSocketPath) { }

    internal SystemdLoggerDriver(string socketPath) {
        Journal = Connect(socketPath);
    }

    public void Write(in LogEntry entry) {
        if (Journal is not null && TrySend(entry))
            return;
        Fallback(entry);
    }

    public void Dispose() => Journal?.Dispose();

    private static Socket? Connect(string socketPath) {
        if (!File.Exists(socketPath))
            return null;
        try {
            var socket = new Socket(AddressFamily.Unix, SocketType.Dgram, ProtocolType.Unspecified);
            socket.Connect(new UnixDomainSocketEndPoint(socketPath));
            return socket;
        } catch {
            return null;
        }
    }

    private bool TrySend(in LogEntry entry) {
        try {
            Journal!.Send(Serialize(entry));
            return true;
        } catch {
            return false;
        }
    }

    private static byte[] Serialize(in LogEntry entry) {
        var message = entry.Error is null ? entry.Message : $"{entry.Message}\n{entry.Error}";
        var buffer = new ArrayBufferWriter<byte>();
        Field(buffer, "PRIORITY", LogFormat.Severity(entry.Level).ToString(CultureInfo.InvariantCulture));
        Field(buffer, "MESSAGE", message);
        return buffer.WrittenSpan.ToArray();
    }

    private static void Field(ArrayBufferWriter<byte> buffer, string name, string value) {
        if (!value.Contains('\n')) {
            Append(buffer, name);
            Append(buffer, "=");
            Append(buffer, value);
            Append(buffer, "\n");
            return;
        }

        Append(buffer, name);
        Append(buffer, "\n");
        var length = buffer.GetSpan(8);
        BinaryPrimitives.WriteUInt64LittleEndian(length, (ulong)Encoding.UTF8.GetByteCount(value));
        buffer.Advance(8);
        Append(buffer, value);
        Append(buffer, "\n");
    }

    private static void Append(ArrayBufferWriter<byte> buffer, string text) {
        var span = buffer.GetSpan(Encoding.UTF8.GetByteCount(text));
        buffer.Advance(Encoding.UTF8.GetBytes(text, span));
    }

    private void Fallback(in LogEntry entry) {
        var prefix = $"<{LogFormat.Severity(entry.Level).ToString(CultureInfo.InvariantCulture)}>";
        Console.Out.WriteLine(prefix + entry.Message);
        if (entry.Error is not null)
            Console.Out.WriteLine(prefix + entry.Error);
    }
}
