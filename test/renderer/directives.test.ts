import { describe, test, expect, beforeEach } from 'vitest';
import { html, render } from '@neuralfog/elemix-renderer';
import { repeat } from '@neuralfog/elemix-renderer/directives';

describe('Directives', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('repeat() with custom keys', () => {
        test('renders list with key function', () => {
            const items = [
                { id: 'a', name: 'Alice' },
                { id: 'b', name: 'Bob' },
            ];
            render(
                html`<ul>${repeat(
                    items,
                    (item) => html`<li>${item.name}</li>`,
                    (item) => item.id,
                )}</ul>`,
                document.body,
            );
            const lis = document.body.querySelectorAll('li');
            expect(lis.length).toBe(2);
            expect(lis[0].textContent).toBe('Alice');
            expect(lis[1].textContent).toBe('Bob');
        });

        test('reorder preserves DOM nodes', () => {
            type Item = { id: string; name: string };
            const t = (list: Item[]) =>
                html`<ul>${repeat(
                    list,
                    (item) => html`<li>${item.name}</li>`,
                    (item) => item.id,
                )}</ul>`;

            const items: Item[] = [
                { id: 'a', name: 'Alice' },
                { id: 'b', name: 'Bob' },
                { id: 'c', name: 'Charlie' },
            ];

            render(t(items), document.body);
            const original = document.body.querySelectorAll('li');
            const liA = original[0];
            const liC = original[2];

            render(t([...items].reverse()), document.body);
            const reordered = document.body.querySelectorAll('li');
            expect(reordered[0]).toBe(liC);
            expect(reordered[2]).toBe(liA);
        });

        test('add and remove with keys', () => {
            type Item = { id: string; name: string };
            const t = (list: Item[]) =>
                html`<ul>${repeat(
                    list,
                    (item) => html`<li>${item.name}</li>`,
                    (item) => item.id,
                )}</ul>`;

            render(t([{ id: 'a', name: 'Alice' }]), document.body);
            expect(document.body.querySelectorAll('li').length).toBe(1);

            render(
                t([
                    { id: 'a', name: 'Alice' },
                    { id: 'b', name: 'Bob' },
                ]),
                document.body,
            );
            expect(document.body.querySelectorAll('li').length).toBe(2);

            render(t([{ id: 'b', name: 'Bob' }]), document.body);
            const remaining = document.body.querySelectorAll('li');
            expect(remaining.length).toBe(1);
            expect(remaining[0].textContent).toBe('Bob');
        });

        test('passes index to callback', () => {
            const items = ['Alice', 'Bob'];
            render(
                html`<ul>${repeat(
                    items,
                    (item, i) => html`<li>${i}: ${item}</li>`,
                    (_, i) => String(i),
                )}</ul>`,
                document.body,
            );
            const lis = document.body.querySelectorAll('li');
            expect(lis[0].textContent).toBe('0: Alice');
            expect(lis[1].textContent).toBe('1: Bob');
        });
    });
});
