using System.Buffers;
using System.Text.Json;
using Hydris.Http;

namespace Hydris.Contracts;

public readonly record struct ValidationError(string Field, string Code, string Message);

public sealed class ContractValidation {
    private List<ValidationError>? Errors;

    public bool Failed => Errors is { Count: > 0 };

    public void Add(string field, string code, string message) =>
        (Errors ??= []).Add(new ValidationError(field, code, message));

    public Reply ToReply() {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer)) {
            writer.WriteStartObject();
            writer.WriteStartArray("errors");
            if (Errors is not null) {
                foreach (var error in Errors) {
                    writer.WriteStartObject();
                    writer.WriteString("field", error.Field);
                    writer.WriteString("code", error.Code);
                    writer.WriteString("message", error.Message);
                    writer.WriteEndObject();
                }
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        return Reply.Json(buffer.WrittenSpan).Status(400);
    }
}
