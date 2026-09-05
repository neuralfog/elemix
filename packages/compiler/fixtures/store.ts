import { store } from '@neuralfog/elemix/ssr-runtime/client';

export const prefs = store('prefs', { count: 0, big: '' });
