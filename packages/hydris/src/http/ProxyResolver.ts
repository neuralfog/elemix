import { Header } from '../constants';
import type { Request } from './Request';

export class ProxyResolver {
    private static readonly FORWARDED_IP_HEADERS = [
        Header.CfConnectingIp,
        Header.TrueClientIp,
        Header.XForwardedFor,
    ];

    static resolveIp(
        req: Request,
        socketIp: string,
        trustProxy: boolean,
    ): string {
        if (trustProxy) {
            for (const header of ProxyResolver.FORWARDED_IP_HEADERS) {
                const value = req.headers.get(header);
                if (value) return value.split(',')[0].trim();
            }
        }
        return socketIp;
    }

    static resolveProtocol(req: Request, trustProxy: boolean): string {
        if (trustProxy) {
            const forwarded = req.headers.get(Header.XForwardedProto);
            if (forwarded) return forwarded.split(',')[0].trim();
        }
        return new URL(req.url).protocol.replace(':', '');
    }
}
