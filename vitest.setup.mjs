import { vi } from 'vitest';
import { MockCSSStyleSheet } from './testing/mocks';

vi.stubGlobal('CSSStyleSheet', MockCSSStyleSheet);
