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
            foreach (var pair in request.QueryValues)
                writer.WriteString(pair.Key, pair.Value);
            writer.WriteEndObject();
            writer.WriteString("csrf", StubCsrf);
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }
}
