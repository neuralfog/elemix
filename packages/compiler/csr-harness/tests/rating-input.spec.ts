import { expect, test } from '@playwright/test';

test('rating-input: #form star repeat renders 5 stars and reactively lights up on click', async ({
    page,
}) => {
    await page.goto('/view/rating-input');

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
