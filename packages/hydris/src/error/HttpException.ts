export class HttpException extends Error {
    constructor(
        public readonly status: number,
        message?: string,
    ) {
        super(message ?? `HTTP ${status}`);
        this.name = new.target.name;
    }
}

export class BadRequestException extends HttpException {
    constructor(message?: string) {
        super(400, message);
    }
}

export class UnauthorizedException extends HttpException {
    constructor(message?: string) {
        super(401, message);
    }
}

export class ForbiddenException extends HttpException {
    constructor(message?: string) {
        super(403, message);
    }
}

export class NotFoundException extends HttpException {
    constructor(message?: string) {
        super(404, message);
    }
}

export class MethodNotAllowedException extends HttpException {
    constructor(
        public readonly allowed: string[] = [],
        message?: string,
    ) {
        super(405, message);
    }
}

export class ValidationException extends HttpException {
    constructor(message?: string) {
        super(422, message);
    }
}
