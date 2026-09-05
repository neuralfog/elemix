import { expect, test } from '@playwright/test';

test('chat-app: sends messages, ignores blanks, auto-scrolls', async ({
    page,
}) => {
    await page.goto('/view/chat-app');
    const input = page.locator('input');
    const sendBtn = page.locator('.composer button');
    const log = page.locator('.log');
    const messages = log.locator('.msg');

    await expect(messages).toHaveText([
        'Hey there 👋',
        'This log auto-scrolls.',
        'Send a few messages and watch.',
    ]);
    await expect(log.locator('.msg.me')).toHaveCount(0);

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

    const [scrollHeight, clientHeight] = await log.evaluate((el) => [
        el.scrollHeight,
        el.clientHeight,
    ]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);
});
