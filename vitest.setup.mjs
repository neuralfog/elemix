import { vi } from 'vitest';
import { MockCSSStyleSheet } from '@neuralfog/elemix-testing/mocks';

vi.stubGlobal('CSSStyleSheet', MockCSSStyleSheet);
