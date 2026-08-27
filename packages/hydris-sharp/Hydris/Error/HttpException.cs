namespace Hydris.Error;

public class HttpException : Exception {
    public int Status { get; }

    public HttpException(int status, string? message = null)
        : base(message ?? ReasonPhrase(status)) {
        Status = status;
    }

    private static string ReasonPhrase(int status) => status switch {
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        422 => "Unprocessable Entity",
        500 => "Internal Server Error",
        _ => $"HTTP {status}",
    };
}

public sealed class BadRequestException(string? message = null) : HttpException(400, message);

public sealed class UnauthorizedException(string? message = null) : HttpException(401, message);

public sealed class ForbiddenException(string? message = null) : HttpException(403, message);

public sealed class NotFoundException(string? message = null) : HttpException(404, message);

public sealed class ValidationException(string? message = null) : HttpException(422, message);

public sealed class MethodNotAllowedException(IReadOnlyList<string> allowed, string? message = null)
    : HttpException(405, message) {
    public IReadOnlyList<string> Allowed { get; } = allowed;
}
