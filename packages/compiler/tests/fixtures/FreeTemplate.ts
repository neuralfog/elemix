import { ref, tpl } from '@neuralfog/elemix';

import './ProfileCard';

// #state
export const store = { name: ref('Ada Lovelace'), likes: 0 };

export const render = () => tpl`
    <label>
        Name
        <input type="text" ~model=${store.name} />
    </label>
    <profile-card
        :name=${store.name.value}
        :likes=${store.likes}
    ></profile-card>
`;
