import { Reply } from '@neuralfog/hydris/http';
import { TestController } from './TestController';

const kebab = (name: string): string =>
    name
        .replace(/_/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();

export class IndexController {
    index(): Reply {
        const proto = TestController.prototype as unknown as Record<
            string,
            unknown
        >;
        const links = Object.getOwnPropertyNames(proto)
            .filter(
                (name) =>
                    name !== 'constructor' && typeof proto[name] === 'function',
            )
            .map((name) => `<li><a href="/${kebab(name)}">${name}</a></li>`)
            .join('');
        return Reply.html(`<h1>fixtures</h1><ul>${links}</ul>`);
    }
}
