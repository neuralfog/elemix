using System.Buffers;
using System.Text;
using System.Text.Json;

namespace Hydris.Http;

internal static class RequestContext {
    private const string StubCsrf = "stub-csrf-token";

    public static string Build(Request request) {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer)) {
            writer.WriteStartObject();
            writer.WritePropertyName("params");
            writer.WriteStartObject();
            foreach (var pair in request.Params)
                writer.WriteString(pair.Key, pair.Value);
            writer.WriteEndObject();
            writer.WritePropertyName("query");
            writer.WriteStartObject();
            WriteQuery(writer, request.Query);
            writer.WriteEndObject();
            writer.WriteString("csrf", StubCsrf);
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private static void WriteQuery(Utf8JsonWriter writer, string query) {
        if (string.IsNullOrEmpty(query))
            return;
        var span = query[0] == '?' ? query.AsSpan(1) : query.AsSpan();
        foreach (var range in span.Split('&')) {
            var pair = span[range];
            if (pair.IsEmpty)
                continue;
            var eq = pair.IndexOf('=');
            var key = eq < 0 ? pair : pair[..eq];
            var value = eq < 0 ? [] : pair[(eq + 1)..];
            writer.WriteString(Decode(key), Decode(value));
        }
    }

    private static string Decode(ReadOnlySpan<char> value) =>
        Uri.UnescapeDataString(value.ToString().Replace('+', ' '));
}
