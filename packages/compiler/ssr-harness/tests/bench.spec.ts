import { expect, test } from '@playwright/test';

test.describe('BenchApp', () => {
    test('keyed repeat: create / select / update / swap / append / remove / clear', async ({
        page,
    }) => {
        await page.goto('/bench-app');
        await page.waitForFunction(() => !!customElements.get('bench-app'));

        const bar = page.locator('bench-app .bar button');
        const rows = page.locator('bench-app tbody tr');
        const idAt = (i: number) => rows.nth(i).locator('.col-id');
        const lblAt = (i: number) => rows.nth(i).locator('.lbl');

        await expect(rows).toHaveCount(0);

        await bar.nth(0).click();
        await expect(rows).toHaveCount(1000);
        await expect(idAt(0)).toHaveText('1');
        const firstLabel = (await lblAt(0).innerText()).trim();
        expect(firstLabel.length).toBeGreaterThan(0);
        await expect(rows.nth(0).locator('.remove')).toHaveText('×');

        await expect(rows.nth(0)).not.toHaveClass(/danger/);
        await lblAt(0).click();
        await expect(rows.nth(0)).toHaveClass(/danger/);
        await expect(page.locator('bench-app tr.danger')).toHaveCount(1);

        await lblAt(1).click();
        await expect(rows.nth(1)).toHaveClass(/danger/);
        await expect(rows.nth(0)).not.toHaveClass(/danger/);
        await expect(page.locator('bench-app tr.danger')).toHaveCount(1);

        await bar.nth(3).click();
        await expect(lblAt(0)).toHaveText(`${firstLabel} !!!`);
        expect((await lblAt(1).innerText()).trim().endsWith(' !!!')).toBe(
            false,
        );

        const id1 = (await idAt(1).innerText()).trim();
        const id998 = (await idAt(998).innerText()).trim();
        expect(id1).not.toBe(id998);
        await bar.nth(5).click();
        await expect(idAt(1)).toHaveText(id998);
        await expect(idAt(998)).toHaveText(id1);
        await expect(rows).toHaveCount(1000);

        await bar.nth(2).click();
        await expect(rows).toHaveCount(2000);

        const topId = (await idAt(0).innerText()).trim();
        await rows.nth(0).locator('.remove').click();
        await expect(rows).toHaveCount(1999);
        await expect(idAt(0)).not.toHaveText(topId);

        await bar.nth(4).click();
        await expect(rows).toHaveCount(0);

        await bar.nth(1).click();
        await expect(rows).toHaveCount(10000);

        await bar.nth(4).click();
        await expect(rows).toHaveCount(0);
    });
});
