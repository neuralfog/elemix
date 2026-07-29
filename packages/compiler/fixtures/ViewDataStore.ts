import { viewData } from '@neuralfog/elemix';

export type Seed = {
    start: number;
};

// #state
export const counter = { count: viewData<Seed>().start };
