namespace Hydris.Container;

public abstract class ServiceProvider {
    public abstract void Register(DiContainer container);

    public virtual void Boot(DiContainer container) {
    }
}
