import { existsSync, unlinkSync } from 'node:fs';

const sock = process.env.RENDER_SOCK ?? '/tmp/hydris-render.sock';
if (existsSync(sock)) unlinkSync(sock);

const render = (method: string, path: string): string =>
    `<!doctype html><h1>Hello from Bun</h1><p>${method} ${path}</p><p>rendered @ ${Date.now()}</p>`;

Bun.listen<{ buf: Buffer }>({
    unix: sock,
    socket: {
        open(socket) {
            socket.data = { buf: Buffer.alloc(0) };
        },
        data(socket, chunk) {
            let buf =
                socket.data.buf.length === 0
                    ? Buffer.from(chunk)
                    : Buffer.concat([socket.data.buf, chunk]);

            while (buf.length >= 4) {
                const len = buf.readUInt32LE(0);
                if (buf.length < 4 + len) break;

                const req = JSON.parse(buf.toString('utf8', 4, 4 + len));
                const html = Buffer.from(render(req.method, req.path), 'utf8');
                const frame = Buffer.allocUnsafe(4 + html.length);
                frame.writeUInt32LE(html.length, 0);
                html.copy(frame, 4);
                socket.write(frame);

                buf = buf.subarray(4 + len);
            }

            socket.data.buf = buf;
        },
    },
});
