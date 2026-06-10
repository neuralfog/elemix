/// <reference types="@vitest/browser-playwright" />
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Turns every story into a browser test: each story is mounted in real Chromium
// and fails if it throws while rendering. This is the conformance layer — it
// runs the compiler's actual output, not its emitted text. (addon-vitest applies
// the .storybook/preview annotations automatically since Storybook 10.3.)
export default defineConfig({
    plugins: [storybookTest({ configDir: '.storybook' })],
    test: {
        name: 'storybook',
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
        },
    },
});
