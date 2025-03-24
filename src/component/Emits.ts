export class Emits<ComponentEmits = unknown> {
    public data = {} as ComponentEmits;

    public set(name: string, value: unknown) {
        (this.data as any)[name] = value;
    }
}
