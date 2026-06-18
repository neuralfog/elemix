import { Component, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Template } from '@neuralfog/elemix/types';

type Geo = { lat: number; lng: number };
type Task = { id: string; label: string; done: boolean };
type Group = { id: string; tasks: Task[] };

type State = {
    profile: {
        name: string;
        address: { city: string; geo: Geo };
        tags: string[];
    };
    grid: number[][];
    groups: Group[];
};

const css = `
    :host { display: block; font-family: system-ui, sans-serif; }
    ul { list-style: none; margin: 0; padding: 0; }
    button { font: inherit; cursor: pointer; }
`;

// #component
export class DeepStateApp extends Component {
    // #styles
    styles = css;

    // #state
    state: State = {
        profile: {
            name: 'Ada',
            address: { city: 'London', geo: { lat: 51, lng: 0 } },
            tags: ['a', 'b'],
        },
        grid: [
            [1, 2],
            [3, 4],
        ],
        groups: [
            { id: 'g0', tasks: [{ id: 't0', label: 'write', done: false }] },
        ],
    };

    get tagsStr(): string {
        return this.state.profile.tags.join(',');
    }

    get gridStr(): string {
        return this.state.grid.map((row) => row.join('|')).join(' ');
    }

    get cell(): number {
        return this.state.grid[0][1];
    }

    get groupsStr(): string {
        return this.state.groups
            .map(
                (g) =>
                    `${g.id}(${g.tasks
                        .map((t) => t.label + (t.done ? '!' : ''))
                        .join(',')})`,
            )
            .join(' ');
    }

    renameCity = (): void => {
        this.state.profile.address.city = 'Paris';
    };

    moveLat = (): void => {
        this.state.profile.address.geo.lat++;
    };

    replaceGeo = (): void => {
        this.state.profile.address.geo = { lat: 99, lng: 99 };
    };

    addTag = (): void => {
        this.state.profile.tags.push('c');
    };

    setCell = (): void => {
        this.state.grid[0][1] = 9;
    };

    pushCol = (): void => {
        this.state.grid[0].push(5);
    };

    addRowGrid = (): void => {
        this.state.grid.push([7, 8]);
    };

    toggleTask = (): void => {
        const task = this.state.groups[0].tasks[0];
        task.done = !task.done;
    };

    addTask = (): void => {
        this.state.groups[0].tasks.push({
            id: 't1',
            label: 'review',
            done: false,
        });
    };

    addGroup = (): void => {
        this.state.groups.push({ id: 'g1', tasks: [] });
    };

    template = (): Template => tpl`
        <section class="readouts">
            <span class="city">${this.state.profile.address.city}</span>
            <span class="lat">${this.state.profile.address.geo.lat}</span>
            <span class="lng">${this.state.profile.address.geo.lng}</span>
            <span class="tags">${this.tagsStr}</span>
            <span class="grid">${this.gridStr}</span>
            <span class="cell">${this.cell}</span>
            <span class="groups-str">${this.groupsStr}</span>
        </section>
        <div class="controls">
            <button class="rename-city" @click=${this.renameCity}>city</button>
            <button class="move-lat" @click=${this.moveLat}>lat</button>
            <button class="replace-geo" @click=${this.replaceGeo}>geo</button>
            <button class="add-tag" @click=${this.addTag}>tag</button>
            <button class="set-cell" @click=${this.setCell}>cell</button>
            <button class="push-col" @click=${this.pushCol}>col</button>
            <button class="add-row" @click=${this.addRowGrid}>row</button>
            <button class="toggle-task" @click=${this.toggleTask}>task</button>
            <button class="add-task" @click=${this.addTask}>+task</button>
            <button class="add-group" @click=${this.addGroup}>+group</button>
        </div>
        <ul class="group-list">
            ${repeat(
                this.state.groups,
                (group) => tpl`
                    <li class="group">
                        <span class="gid">${group.id}</span>
                        <span class="tcount">${group.tasks.length}</span>
                    </li>
                `,
                (group) => group.id,
            )}
        </ul>
    `;
}
