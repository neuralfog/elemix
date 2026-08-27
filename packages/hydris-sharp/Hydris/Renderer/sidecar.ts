import { existsSync, unlinkSync } from 'node:fs';

const sock = process.env.RENDER_SOCK ?? '/tmp/hydris-render.sock';
if (existsSync(sock)) unlinkSync(sock);

const evaluate = (source: string): string => {
    try {
        return String(eval(source));
    } catch (error) {
        return String(error);
    }
};

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

                const source = buf.toString('utf8', 4, 4 + len);
                const output = Buffer.from(evaluate(source), 'utf8');
                const frame = Buffer.allocUnsafe(4 + output.length);
                frame.writeUInt32LE(output.length, 0);
                output.copy(frame, 4);
                socket.write(frame);

                buf = buf.subarray(4 + len);
            }

            socket.data.buf = buf;
        },
    },
});
