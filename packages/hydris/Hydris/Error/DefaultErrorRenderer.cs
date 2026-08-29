using System.Text.Json.Serialization;
using Hydris.Http;

namespace Hydris.Error;

public sealed class DefaultErrorRenderer : IErrorRenderer {
    public Reply Render(Exception error, Request request, bool json) {
        var status = StatusOf(error);
        var message = MessageOf(error);

        if (json || WantsJson(request))
            return Reply.Json(new ErrorPayload(message, status), ErrorJson.Default.ErrorPayload).Status(status);

        return Reply.Html(Page(status, message)).Status(status);
    }

    internal static int StatusOf(Exception error) => error is HttpException http ? http.Status : 500;

    private static string MessageOf(Exception error) =>
        error is HttpException http ? http.Message : "Internal Server Error";

    private static bool WantsJson(Request request) =>
        (request.Header("Accept") ?? string.Empty).Contains("application/json", StringComparison.Ordinal);

    private static string Page(int status, string message) =>
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        $"<title>{status}</title></head>" +
        "<body style=\"font-family:system-ui,sans-serif;display:grid;place-items:center;" +
        "min-height:100vh;margin:0;color:#111\">" +
        $"<main style=\"text-align:center\"><h1 style=\"font-size:4rem;margin:0\">{status}</h1>" +
        $"<p style=\"opacity:.7\">{Escape(message)}</p></main></body></html>";

    private static string Escape(string value) => value
        .Replace("&", "&amp;")
        .Replace("<", "&lt;")
        .Replace(">", "&gt;")
        .Replace("\"", "&quot;")
        .Replace("'", "&#39;");
}

internal sealed record ErrorPayload(
    [property: JsonPropertyName("error")] string Error,
    [property: JsonPropertyName("status")] int Status);

[JsonSerializable(typeof(ErrorPayload))]
internal sealed partial class ErrorJson : JsonSerializerContext;
