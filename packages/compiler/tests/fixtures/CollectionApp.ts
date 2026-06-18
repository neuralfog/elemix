import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type State = {
    tags: Set<string>;
    scores: Map<string, number>;
    seen: WeakSet<object>;
    meta: WeakMap<object, string>;
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class CollectionApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        tags: new Set<string>(['new', 'featured']),
        scores: new Map<string, number>([['alice', 10]]),
        seen: new WeakSet<object>(),
        meta: new WeakMap<object, string>(),
    };

    private readonly token: object = {};

    get setKeys(): string {
        return [...this.state.tags.keys()].join(',');
    }

    get setValues(): string {
        return [...this.state.tags.values()].join(',');
    }

    get setEntries(): string {
        return [...this.state.tags.entries()]
            .map(([a, b]) => `${a}=${b}`)
            .join(',');
    }

    get setIter(): string {
        return [...this.state.tags].join(',');
    }

    get setForEach(): string {
        const out: string[] = [];
        this.state.tags.forEach((value) => out.push(value));
        return out.join(',');
    }

    get mapKeys(): string {
        return [...this.state.scores.keys()].join(',');
    }

    get mapValues(): string {
        return [...this.state.scores.values()].join(',');
    }

    get mapEntries(): string {
        return [...this.state.scores.entries()]
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
    }

    get mapIter(): string {
        return [...this.state.scores].map(([k, v]) => `${k}=${v}`).join(',');
    }

    get total(): number {
        let sum = 0;
        this.state.scores.forEach((value) => {
            sum += value;
        });
        return sum;
    }

    addTag = (): void => {
        this.state.tags.add('vip');
    };

    removeTag = (): void => {
        this.state.tags.delete('vip');
    };

    clearTags = (): void => {
        this.state.tags.clear();
    };

    bumpAlice = (): void => {
        const current = this.state.scores.get('alice') ?? 0;
        this.state.scores.set('alice', current + 1);
    };

    setBob = (): void => {
        this.state.scores.set('bob', 5);
    };

    deleteAlice = (): void => {
        this.state.scores.delete('alice');
    };

    clearScores = (): void => {
        this.state.scores.clear();
    };

    addSeen = (): void => {
        this.state.seen.add(this.token);
    };

    deleteSeen = (): void => {
        this.state.seen.delete(this.token);
    };

    setMeta = (): void => {
        this.state.meta.set(this.token, 'hello');
    };

    deleteMeta = (): void => {
        this.state.meta.delete(this.token);
    };

    template = (): Template => tpl`
        <section class="set">
            <span class="set-size">${this.state.tags.size}</span>
            <span class="set-has">${this.state.tags.has('vip')}</span>
            <span class="set-keys">${this.setKeys}</span>
            <span class="set-values">${this.setValues}</span>
            <span class="set-entries">${this.setEntries}</span>
            <span class="set-iter">${this.setIter}</span>
            <span class="set-foreach">${this.setForEach}</span>
        </section>
        <section class="map">
            <span class="map-size">${this.state.scores.size}</span>
            <span class="map-get">${this.state.scores.get('alice')}</span>
            <span class="map-has">${this.state.scores.has('alice')}</span>
            <span class="map-keys">${this.mapKeys}</span>
            <span class="map-values">${this.mapValues}</span>
            <span class="map-entries">${this.mapEntries}</span>
            <span class="map-iter">${this.mapIter}</span>
            <span class="map-total">${this.total}</span>
        </section>
        <section class="weak">
            <span class="ws-has">${this.state.seen.has(this.token)}</span>
            <span class="wm-has">${this.state.meta.has(this.token)}</span>
            <span class="wm-get">${this.state.meta.get(this.token)}</span>
        </section>
        <div class="controls">
            <button class="add-tag" @click=${this.addTag}>add tag</button>
            <button class="remove-tag" @click=${this.removeTag}>remove tag</button>
            <button class="clear-tags" @click=${this.clearTags}>clear tags</button>
            <button class="bump-alice" @click=${this.bumpAlice}>bump</button>
            <button class="set-bob" @click=${this.setBob}>bob</button>
            <button class="del-alice" @click=${this.deleteAlice}>del alice</button>
            <button class="clear-scores" @click=${this.clearScores}>wipe</button>
            <button class="add-seen" @click=${this.addSeen}>add seen</button>
            <button class="del-seen" @click=${this.deleteSeen}>del seen</button>
            <button class="set-meta" @click=${this.setMeta}>set meta</button>
            <button class="del-meta" @click=${this.deleteMeta}>del meta</button>
        </div>
        <ul class="tags">
            ${repeat(
                [...this.state.tags],
                (tag) => tpl`<li class="tag">${tag}</li>`,
                (tag) => tag,
            )}
        </ul>
        <ul class="scores">
            ${repeat(
                [...this.state.scores.keys()],
                (name) =>
                    tpl`<li class="score">${name}: ${this.state.scores.get(name)}</li>`,
                (name) => name,
            )}
        </ul>
    `;
}
