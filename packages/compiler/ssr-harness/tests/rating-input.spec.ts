import { expect, test } from '@playwright/test';

test.describe('RatingInput', () => {
    test('#form star repeat SSRs 5 stars and reactively lights up on click', async ({
        page,
    }) => {
        const response = await page.goto('/rating-input');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('rating-input');
        expect(served).toContain('class="star"');

        await page.waitForFunction(() => !!customElements.get('rating-input'));

        const stars = page.locator('rating-input .star');
        const onStars = page.locator('rating-input .star.on');

        await expect(stars).toHaveCount(5);
        await expect(onStars).toHaveCount(0);

        await stars.nth(2).click();
        await expect(onStars).toHaveCount(3);
        await expect(stars.nth(0)).toHaveClass(/on/);
        await expect(stars.nth(2)).toHaveClass(/on/);
        await expect(stars.nth(3)).not.toHaveClass(/on/);

        await stars.nth(4).click();
        await expect(onStars).toHaveCount(5);

        await stars.nth(0).click();
        await expect(onStars).toHaveCount(1);
    });
});
