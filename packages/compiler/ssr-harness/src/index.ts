import { App } from '@neuralfog/hydris';
import './routes/web';

App.serve({
    port: Number(Bun.env.PORT ?? 4242),
    hostname: Bun.env.HOST ?? 'localhost',
    development: Bun.env.NODE_ENV !== 'production',
});
