import { Component, defineComponent } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

import { log } from './LifecycleStore';

const css = `
    :host { display: block; }
    .log {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 180px;
        overflow-y: auto;
        padding: 8px;
        background: #0f172a;
        border-radius: 10px;
    }
    .entry {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        color: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
    }
    .entry .n { color: #64748b; margin-right: 8px; }
    .beforeMount { color: #fbbf24; }
    .onMount { color: #34d399; }
    .onMutation { color: #60a5fa; }
    .onDispose { color: #f87171; }
    .empty { font-size: 12px; color: #64748b; padding: 2px 6px; }
`;

export class LogView extends Component {
    static styles = [css];

    template = (): Template => tpl`<div class="log">
        ${
            log.entries.length
                ? repeat(
                      log.entries,
                      (e) => tpl`<div class=${{ entry: true, [e.event]: true }}>
                          <span class="n">${e.id}</span>${e.event}()
                      </div>`,
                      (e) => String(e.id),
                  )
                : tpl`<div class="empty">No events yet — mount the child.</div>`
        }
    </div>`;
}

defineComponent('log-view', LogView);
