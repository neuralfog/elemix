import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const hydrate = async (page: Page): Promise<Locator> => {
    await page.goto('/actions-app');
    await page.waitForFunction(
        () => !!customElements.get('actions-app'),
        undefined,
        {
            timeout: 10_000,
        },
    );
    return page.locator('actions-app');
};

const fill = async (
    page: Page,
    values: Record<string, string>,
): Promise<void> => {
    for (const [id, value] of Object.entries(values)) {
        await page.fill(`#${id}`, value);
    }
};

test.describe('ActionsApp (actions end to end)', () => {
    test('SSR renders the action shell before hydration', async ({ page }) => {
        const res = await page.goto('/actions-app');
        const html = (await res?.text()) ?? '';
        expect(html).toContain('id="create"');
        expect(html).toContain('class="echo"');
        expect(html).toContain('id="conflict"');
    });

    test('POST success returns 201 with Location header and renders the body', async ({
        page,
    }) => {
        const root = await hydrate(page);

        const waitResponse = page.waitForResponse(
            (r) =>
                r.url().endsWith('/api/users') &&
                r.request().method() === 'POST',
        );
        await root.locator('#create').click();
        const response = await waitResponse;

        expect(response.status()).toBe(201);
        expect(response.headers().location).toBe('/api/users/u1');
        await expect(root.locator('.create-data')).toHaveText(
            'u1 Ada ada-lovelace',
        );
    });

    test('POST surfaces every field validation error with field and code', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await fill(page, {
            'f-name': 'A',
            'f-email': 'not-an-email',
            'f-handle': 'Bad Handle',
            'f-age': '5',
        });
        await root.locator('#create').click();

        const errors = root.locator('.create-errors .err');
        await expect(errors).toHaveCount(4);
        await expect(root.locator('.err[data-field="name"]')).toHaveAttribute(
            'data-code',
            'between',
        );
        await expect(root.locator('.err[data-field="email"]')).toHaveAttribute(
            'data-code',
            'email',
        );
        await expect(root.locator('.err[data-field="handle"]')).toHaveAttribute(
            'data-code',
            'slug',
        );
        await expect(root.locator('.err[data-field="age"]')).toHaveAttribute(
            'data-code',
            'between',
        );
        await expect(root.locator('.create-data')).toHaveCount(0);
    });

    test('empty fields fail their content rules', async ({ page }) => {
        const root = await hydrate(page);
        await fill(page, { 'f-name': '', 'f-email': '', 'f-handle': '' });
        await root.locator('#create').click();

        await expect(
            root.locator('.err[data-field="name"][data-code="between"]'),
        ).toHaveCount(1);
        await expect(
            root.locator('.err[data-field="email"][data-code="email"]'),
        ).toHaveCount(1);
        await expect(
            root.locator('.err[data-field="handle"][data-code="filled"]'),
        ).toHaveCount(1);
    });

    test('GET binds a route param to the handler arg', async ({ page }) => {
        const root = await hydrate(page);
        await fill(page, { 'f-id': 'alpha' });
        await root.locator('#get').click();
        await expect(root.locator('.get-data')).toHaveText(
            'alpha User alpha user-alpha',
        );
    });

    test('GET binds query params and converts page to a number', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await fill(page, { 'f-echo-value': 'kodak', 'f-echo-page': '7' });
        await root.locator('#echo').click();
        await expect(root.locator('.echo-data')).toHaveText('kodak 7');
    });

    test('PUT binds route id and body together', async ({ page }) => {
        const root = await hydrate(page);
        await fill(page, { 'f-id': 'beta', 'f-name': 'Grace' });
        await root.locator('#update').click();
        await expect(root.locator('.update-data')).toHaveText('beta Grace');
    });

    test('DELETE binds a route param', async ({ page }) => {
        const root = await hydrate(page);
        await fill(page, { 'f-id': 'gamma' });
        await root.locator('#delete').click();
        await expect(root.locator('.delete-data')).toHaveText('gamma deleted');
    });

    test('a non-ok status surfaces as an http error with the code', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await root.locator('#conflict').click();
        await expect(root.locator('.conflict-http')).toHaveText('http 409');
    });

    test('an aborted request surfaces as a network error', async ({ page }) => {
        const root = await hydrate(page);
        await page.route('**/api/users/**', (route) => route.abort());
        await fill(page, { 'f-id': 'x' });
        await root.locator('#get').click();
        await expect(root.locator('.get-network')).toHaveText('network');
        await expect(root.locator('.get-data')).toHaveCount(0);
    });

    test('loading toggles around a slow call', async ({ page }) => {
        const root = await hydrate(page);
        await root.locator('#echo-slow').click();
        await expect(root.locator('.echo-loading')).toBeVisible();
        await expect(root.locator('.echo-data')).toHaveText('slow 1');
        await expect(root.locator('.echo-loading')).toHaveCount(0);
    });

    test('a second run aborts the first in-flight call (no stale overwrite)', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await root.locator('#echo-slow').click();
        await root.locator('#echo-fast').click();

        await expect(root.locator('.echo-data')).toHaveText('fast 2');
        await page.waitForTimeout(900);
        await expect(root.locator('.echo-data')).toHaveText('fast 2');
    });

    test('state machine: idle to ok to error (clears data) to ok (clears error)', async ({
        page,
    }) => {
        const root = await hydrate(page);
        const state = root.locator('.create-state');
        await expect(state).toHaveText('idle');

        await root.locator('#create').click();
        await expect(state).toHaveText('ok');
        await expect(root.locator('.create-data')).toHaveText(
            'u1 Ada ada-lovelace',
        );

        await fill(page, { 'f-email': 'nope' });
        await root.locator('#create').click();
        await expect(state).toHaveText('error');
        await expect(root.locator('.create-data')).toHaveCount(0);
        await expect(root.locator('.create-errors .err')).toHaveCount(1);

        await fill(page, { 'f-email': 'ada@example.com' });
        await root.locator('#create').click();
        await expect(state).toHaveText('ok');
        await expect(root.locator('.create-errors')).toHaveCount(0);
    });

    test('isError flips and loading clears after an http error', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await expect(root.locator('.conflict-state')).toHaveText('idle');
        await root.locator('#conflict').click();
        await expect(root.locator('.conflict-state')).toHaveText('error');
    });

    test('loading badge settles back to ok after a slow success', async ({
        page,
    }) => {
        const root = await hydrate(page);
        await expect(root.locator('.echo-state')).toHaveText('idle');
        await root.locator('#echo-slow').click();
        await expect(root.locator('.echo-state')).toHaveText('loading');
        await expect(root.locator('.echo-state')).toHaveText('ok');
    });
});
