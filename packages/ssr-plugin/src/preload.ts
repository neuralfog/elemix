import { plugin } from 'bun';
import { ssrPlugin } from './plugin';
import { sassPlugin } from './sass';

plugin(ssrPlugin);
plugin(sassPlugin);
