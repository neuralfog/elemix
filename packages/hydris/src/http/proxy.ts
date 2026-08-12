import type { Request } from './Request';

const FORWARDED_IP_HEADERS = [
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-for',
];

export const resolveIp = (
    req: Request,
    socketIp: string,
    trustProxy: boolean,
): string => {
    if (trustProxy) {
        for (const header of FORWARDED_IP_HEADERS) {
            const value = req.headers.get(header);
            if (value) return value.split(',')[0].trim();
        }
    }
    return socketIp;
};

export const resolveProtocol = (req: Request, trustProxy: boolean): string => {
    if (trustProxy) {
        const forwarded = req.headers.get('x-forwarded-proto');
        if (forwarded) return forwarded.split(',')[0].trim();
    }
    return new URL(req.url).protocol.replace(':', '');
};
