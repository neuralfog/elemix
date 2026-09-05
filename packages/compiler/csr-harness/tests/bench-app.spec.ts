import { expect, test } from '@playwright/test';

test('bench-app: create, select, update, swap, append, remove, clear', async ({
    page,
}) => {
    await page.goto('/view/bench-app');
    const buttons = page.locator('.bar button');
    const createBtn = buttons.nth(0);
    const createLotsBtn = buttons.nth(1);
    const appendBtn = buttons.nth(2);
    const updateBtn = buttons.nth(3);
    const clearBtn = buttons.nth(4);
    const swapBtn = buttons.nth(5);

    await expect(createBtn).toHaveText('Create 1,000 rows');
    await expect(createLotsBtn).toHaveText('Create 10,000 rows');
    await expect(appendBtn).toHaveText('Append 1,000 rows');
    await expect(updateBtn).toHaveText('Update every 10th row');
    await expect(clearBtn).toHaveText('Clear');
    await expect(swapBtn).toHaveText('Swap Rows');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(0);

    await createBtn.click();
    await expect(rows).toHaveCount(1000);
    await expect(rows.nth(0).locator('.col-id')).toHaveText('1');
    const firstLabel = rows.nth(0).locator('.lbl');
    const firstLabelText = ((await firstLabel.textContent()) ?? '').trim();
    expect(firstLabelText.length).toBeGreaterThan(0);
    await expect(rows.nth(0).locator('.remove')).toHaveText('×');

    await expect(rows.nth(0)).not.toHaveClass(/\bdanger\b/);
    await firstLabel.click();
    await expect(rows.nth(0)).toHaveClass(/\bdanger\b/);
    await expect(page.locator('tbody tr.danger')).toHaveCount(1);

    await rows.nth(1).locator('.lbl').click();
    await expect(rows.nth(1)).toHaveClass(/\bdanger\b/);
    await expect(rows.nth(0)).not.toHaveClass(/\bdanger\b/);
    await expect(page.locator('tbody tr.danger')).toHaveCount(1);

    await updateBtn.click();
    await expect(rows.nth(0).locator('.lbl')).toHaveText(
        `${firstLabelText} !!!`,
    );
    const secondLabel = (await rows.nth(1).locator('.lbl').textContent()) ?? '';
    expect(secondLabel.endsWith(' !!!')).toBe(false);

    const idAt1 = await rows.nth(1).locator('.col-id').textContent();
    const idAt998 = await rows.nth(998).locator('.col-id').textContent();
    expect(idAt1).not.toBe(idAt998);
    await swapBtn.click();
    await expect(rows.nth(1).locator('.col-id')).toHaveText(idAt998 ?? '');
    await expect(rows.nth(998).locator('.col-id')).toHaveText(idAt1 ?? '');
    await expect(rows).toHaveCount(1000);

    await appendBtn.click();
    await expect(rows).toHaveCount(2000);

    const removeId = await rows.nth(0).locator('.col-id').textContent();
    await rows.nth(0).locator('.remove').click();
    await expect(rows).toHaveCount(1999);
    await expect(rows.nth(0).locator('.col-id')).not.toHaveText(removeId ?? '');

    await clearBtn.click();
    await expect(rows).toHaveCount(0);

    await createLotsBtn.click();
    await expect(rows).toHaveCount(10000);

    await clearBtn.click();
    await expect(rows).toHaveCount(0);

    await swapBtn.click();
    await expect(rows).toHaveCount(0);
});
