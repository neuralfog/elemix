import { token } from '../container/Token';

export interface Request<T = Record<string, unknown>>
    extends globalThis.Request {
    id: string;
    bag: T;
    ip?: string;
    protocol?: string;
    csrfToken?: string;
}

export const Request = token<Request>('Request');
