import { expect, test } from '@playwright/test';

test.describe('SecondHelper', () => {
    test('a non-first component inlines its helper template (this.heading()) in SSR + hydrate', async ({
        page,
    }) => {
        const response = await page.goto('/second-helper');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('titled-note');
        expect(served).toContain('<h2 class="heading">Title</h2>');
        expect(served).toContain('<p class="body">body</p>');

        await page.waitForFunction(() => !!customElements.get('titled-note'));

        const heading = page.locator('titled-note .heading');
        const body = page.locator('titled-note .body');

        await expect(heading).toHaveText('Title');
        const tag = await heading.evaluate((el) => el.tagName);
        expect(tag).toBe('H2');
        await expect(body).toHaveText('body');
    });
});
