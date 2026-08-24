export const jsonIsland = (id: string, value: unknown): string =>
    `<script type="application/json" id="${id}">${JSON.stringify(value).replace(
        /</g,
        '\\u003c',
    )}</script>`;
