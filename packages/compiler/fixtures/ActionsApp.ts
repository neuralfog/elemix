import { Component, ref, tpl } from '@neuralfog/elemix';
import { repeat } from '@neuralfog/elemix/directives';
import type { Ref, Template } from '@neuralfog/elemix/types';

import type { ActionError } from '../Views/actions/index';
import { ActionErrorKind } from '../Views/actions/index';
import { conflict } from '../Views/actions/conflict';
import { createUser } from '../Views/actions/createUser';
import { deleteUser } from '../Views/actions/deleteUser';
import { echo } from '../Views/actions/echo';
import { getUser } from '../Views/actions/getUser';
import { updateUser } from '../Views/actions/updateUser';
import { ActionsDocument } from './ActionsDocument';

type Status = {
    data: unknown;
    loading: boolean;
    isError: boolean;
    error: ActionError | null;
};

// #component
export class ActionsApp extends Component {
    // #document
    document = ActionsDocument;

    name: Ref<string> = ref('Ada');
    email: Ref<string> = ref('ada@example.com');
    handle: Ref<string> = ref('ada-lovelace');
    age: Ref<string> = ref('30');
    userId: Ref<string> = ref('42');
    echoValue: Ref<string> = ref('hello');
    echoPage: Ref<string> = ref('3');

    create = createUser();
    fetchUser = getUser();
    saveUser = updateUser();
    dropUser = deleteUser();
    runEcho = echo();
    runConflict = conflict();

    body = (): {
        name: string;
        email: string;
        handle: string;
        age: number;
    } => ({
        name: this.name.value,
        email: this.email.value,
        handle: this.handle.value,
        age: Number(this.age.value),
    });

    submitCreate = (): void => void this.create.run(this.body());

    getById = (): void => void this.fetchUser.run({ id: this.userId.value });

    submitUpdate = (): void =>
        void this.saveUser.run({ id: this.userId.value, body: this.body() });

    submitDelete = (): void =>
        void this.dropUser.run({ id: this.userId.value });

    submitEcho = (): void =>
        void this.runEcho.run({
            value: this.echoValue.value,
            page: Number(this.echoPage.value),
            delay: 0,
        });

    echoSlow = (): void =>
        void this.runEcho.run({ value: 'slow', page: 1, delay: 600 });

    echoFast = (): void =>
        void this.runEcho.run({ value: 'fast', page: 2, delay: 50 });

    submitConflict = (): void => void this.runConflict.run();

    errors = (prefix: string, status: Status): Template | string => {
        const error = status.error;
        if (!error) return '';
        if (error.kind === ActionErrorKind.Validation)
            return tpl`
                <ul class="${prefix}-errors">
                    ${repeat(
                        error.errors,
                        (item) => tpl`
                            <li
                                class="err"
                                data-field="${item.field}"
                                data-code="${item.code}"
                            >
                                ${item.message}
                            </li>
                        `,
                        (item) => `${item.field}:${item.code}`,
                    )}
                </ul>
            `;
        if (error.kind === ActionErrorKind.Http)
            return tpl`<p class="${prefix}-http">http ${error.status}</p>`;
        return tpl`<p class="${prefix}-network">network</p>`;
    };

    stateOf = (status: Status): string => {
        if (status.loading) return 'loading';
        if (status.isError) return 'error';
        if (status.data) return 'ok';
        return 'idle';
    };

    template = (): Template => tpl`
        <main>
            <section class="create">
                <h2>create</h2>
                <label>name
                <input id="f-name" type="text" ~model=${this.name} /></label>
                <label>email
                <input id="f-email" type="text" ~model=${this.email} /></label>
                <label>handle
                <input id="f-handle" type="text" ~model=${this.handle} /></label>
                <label>age <input id="f-age" type="text" ~model=${this.age} /></label>
                <button id="create" @click=${this.submitCreate}>create</button>
                <span class="create-state">${this.stateOf(this.create)}</span>
                ${this.create.loading ? tpl`<p class="create-loading">saving</p>` : ''}
                ${
                    this.create.data
                        ? tpl`
                            <p class="create-data">
                                ${this.create.data.id} ${this.create.data.name}
                                ${this.create.data.handle}
                            </p>
                        `
                        : ''
                } ${this.errors('create', this.create)}
            </section>
            <section class="get">
                <h2>get</h2>
                <label>id <input id="f-id" type="text" ~model=${this.userId} /></label>
                <button id="get" @click=${this.getById}>get</button>
                ${
                    this.fetchUser.data
                        ? tpl`
                            <p class="get-data">
                                ${this.fetchUser.data.id}
                                ${this.fetchUser.data.name}
                                ${this.fetchUser.data.handle}
                            </p>
                        `
                        : ''
                } ${this.errors('get', this.fetchUser)}
            </section>
            <section class="update">
                <h2>update</h2>
                <button id="update" @click=${this.submitUpdate}>update</button>
                ${
                    this.saveUser.data
                        ? tpl`
                            <p class="update-data">
                                ${this.saveUser.data.id}
                                ${this.saveUser.data.name}
                            </p>
                        `
                        : ''
                } ${this.errors('update', this.saveUser)}
            </section>
            <section class="delete">
                <h2>delete</h2>
                <button id="delete" @click=${this.submitDelete}>delete</button>
                ${
                    this.dropUser.data
                        ? tpl`
                            <p class="delete-data">
                                ${this.dropUser.data.id}
                                ${this.dropUser.data.name}
                            </p>
                        `
                        : ''
                }
            </section>
            <section class="echo">
                <h2>echo</h2>
                <label>value
                <input id="f-echo-value" type="text" ~model=${this.echoValue} /></label>
                <label>page
                <input id="f-echo-page" type="text" ~model=${this.echoPage} /></label>
                <button id="echo" @click=${this.submitEcho}>echo</button>
                <button id="echo-slow" @click=${this.echoSlow}>slow</button>
                <button id="echo-fast" @click=${this.echoFast}>fast</button>
                <span class="echo-state">${this.stateOf(this.runEcho)}</span>
                ${this.runEcho.loading ? tpl`<p class="echo-loading">loading</p>` : ''}
                ${
                    this.runEcho.data
                        ? tpl`
                            <p class="echo-data">
                                ${this.runEcho.data.value}
                                ${this.runEcho.data.page}
                            </p>
                        `
                        : ''
                }
            </section>
            <section class="conflict">
                <h2>conflict</h2>
                <button
                    id="conflict"
                    @click=${this.submitConflict}
                >conflict</button>
                <span
                    class="conflict-state"
                >${this.stateOf(this.runConflict)}</span>
                ${this.errors('conflict', this.runConflict)}
            </section>
        </main>
    `;
}
