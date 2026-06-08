import type { Renderer } from './component/Renderer';
import type { Component } from './component/Component';

export const activeRenderers = new Set<Renderer>();

/**
 * Tracks which component is currently executing template() so that
 * Reactive proxies can auto-subscribe the component when its template
 * reads a signal value.
 *
 * Held inside an object so cross-module mutation is observable.
 */
export const renderTracking: { active: Component | null } = { active: null };
