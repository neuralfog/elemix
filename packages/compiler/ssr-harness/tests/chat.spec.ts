import { expect, test } from '@playwright/test';

test.describe('ChatApp', () => {
    test('seeded messages SSR; send via click + Enter; ~model clears', async ({
        page,
    }) => {
        const response = await page.goto('/chat-app');
        const served = (await response?.text()) ?? '';
        expect(served).toContain('Hey there');
        expect(served).toContain('This log auto-scrolls.');

        await page.waitForFunction(() => !!customElements.get('chat-app'));

        const input = page.locator('chat-app .composer input');
        const sendBtn = page.locator('chat-app .composer button');
        const messages = page.locator('chat-app .log .msg');

        await expect(messages).toHaveCount(3);
        await expect(messages.nth(0)).toHaveText('Hey there 👋');
        await expect(messages.nth(1)).toHaveText('This log auto-scrolls.');
        await expect(messages.nth(2)).toHaveText(
            'Send a few messages and watch.',
        );
        await expect(messages.nth(0)).not.toHaveClass(/\bme\b/);

        await input.fill('   ');
        await sendBtn.click();
        await expect(messages).toHaveCount(3);
        await expect(input).toHaveValue('   ');

        await input.fill('Hello world');
        await sendBtn.click();
        await expect(messages).toHaveCount(4);
        await expect(messages.nth(3)).toHaveText('Hello world');
        await expect(messages.nth(3)).toHaveClass(/\bme\b/);
        await expect(input).toHaveValue('');

        await input.fill('Second message');
        await input.press('Enter');
        await expect(messages).toHaveCount(5);
        await expect(messages.nth(4)).toHaveText('Second message');
        await expect(messages.nth(4)).toHaveClass(/\bme\b/);
        await expect(input).toHaveValue('');

        const scrollable = await page
            .locator('chat-app .log')
            .evaluate((el) => el.scrollHeight > el.clientHeight);
        expect(scrollable).toBe(true);
    });
});
