import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';

const prettifyHTML = (html: string): string => {
    const processor = unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeFormat)
        .use(rehypeStringify);

    const result = processor.processSync(html);
    return result.toString();
};

const extractHTML = (node: any): string => {
    if (!node) return '';
    if (node.nodeType === 3 && node.textContent) return node.textContent.trim();
    if (node.nodeType !== 1) return '';

    let html = '';
    const outer = node.cloneNode();
    if (node.shadowRoot) html += '\n<!-- #shadowroot -->\n';
    // biome-ignore lint:
    node = node.shadowRoot || node;

    if (node.children.length) {
        for (const n of node.childNodes) {
            if (n.assignedNodes) {
                if (n.assignedNodes()[0]) {
                    if (n.nodeName.includes('-')) {
                        html += `\n${extractHTML(n.assignedNodes()[0])}\n`;
                    } else {
                        html += extractHTML(n.assignedNodes()[0]);
                    }
                } else {
                    if (n.nodeName.includes('-')) {
                        html += `\n${n.innerHTML}\n`;
                    } else {
                        html += n.innerHTML;
                    }
                }
            } else {
                if (n.nodeName.includes('-')) {
                    html += `\n${extractHTML(n)}\n`;
                } else {
                    html += extractHTML(n);
                }
            }
        }
    } else {
        html = node.innerHTML;
    }

    outer.innerHTML = html;
    return outer.outerHTML;
};

export const HTML = (element: HTMLElement): string => {
    return prettifyHTML(extractHTML(element));
};
