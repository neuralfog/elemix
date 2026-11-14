using Hydris.Http;

namespace Hydris.Error;

public class HttpException : Exception {
    public Status Status { get; }

    public HttpException(Status status, string? message = null)
        : base(message ?? status.Reason()) {
        Status = status;
    }
}

public sealed class BadRequestException(string? message = null) : HttpException(Status.BadRequest, message);

public sealed class UnauthorizedException(string? message = null) : HttpException(Status.Unauthorized, message);

public sealed class ForbiddenException(string? message = null) : HttpException(Status.Forbidden, message);

public sealed class NotFoundException(string? message = null) : HttpException(Status.NotFound, message);

public sealed class PayloadTooLargeException(string? message = null) : HttpException(Status.PayloadTooLarge, message);

public sealed class ValidationException(string? message = null) : HttpException(Status.UnprocessableEntity, message);

public sealed class MethodNotAllowedException(IReadOnlyList<string> allowed, string? message = null)
    : HttpException(Status.MethodNotAllowed, message) {
    public IReadOnlyList<string> Allowed { get; } = allowed;
}
