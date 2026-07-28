import { token } from '../container/Token';

export interface Request<T = Record<string, unknown>>
    extends globalThis.Request {
    id: string;
    bag: T;
}

export const Request = token<Request>('Request');
