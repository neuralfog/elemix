export { ref, raw, viewData } from '@neuralfog/elemix';

import { $__viewData } from '@neuralfog/elemix/ssr-runtime';

type SlotChild = { getAttribute(attr: string): string | null };
type FormInternals = { setFormValue(): void; setValidity(): void; form: null };

class SsrComponent<Props = unknown, ViewData = unknown> {
    public children?: SlotChild[];
    public $$__props?: Record<string, unknown>;
    public internals!: FormInternals;

    public get props(): Props {
        return this.$$__props as Props;
    }

    public get viewData(): ViewData {
        return $__viewData<ViewData>();
    }

    public hasSlot(name: string): boolean {
        return Array.from(this.children ?? []).some(
            (c) => c.getAttribute('slot') === name,
        );
    }

    public $$__attachFormInternals(): void {
        if (this.internals) return;
        if ((this.constructor as { formAssociated?: boolean }).formAssociated) {
            this.internals = {
                setFormValue() {},
                setValidity() {},
                form: null,
            };
        }
    }
}

export { SsrComponent as Component };
