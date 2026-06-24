import { Component, tpl } from '@neuralfog/elemix';
import type { Template } from '@neuralfog/elemix/types';

export enum Status {
    Active = 'active',
    Inactive = 'inactive',
}

type Props = {
    status: Status;
};

// #component #tag enum-card
export class EnumCard extends Component<Props> {
    template = (): Template => tpl`<div>${this.props.status}</div>`;
}

// #component #tag enum-app
export class EnumApp extends Component {
    // First passes a real enum member → CLEAN. Second passes a bare string that
    // isn't a member → ERROR (enums are nominal; a raw string isn't assignable).
    template = (): Template => tpl`
        <enum-card :status=${Status.Active}></enum-card>
        <enum-card :status=${'bogus'}></enum-card>
    `;
}
