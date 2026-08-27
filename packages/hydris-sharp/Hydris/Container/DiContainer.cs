using System.Collections.Concurrent;
using System.Collections.Frozen;

namespace Hydris.Container;

public sealed class DiContainer : IAsyncDisposable {
    private readonly record struct Registration(Lifetime Lifetime, Func<DiContainer, object> Factory);

    private readonly DiContainer? Parent;
    private readonly DiContainer Root;
    private readonly ConcurrentDictionary<Type, object>? Shared;
    private readonly object? BuildLock;

    private Dictionary<Type, object>? Local;
    private Dictionary<Type, Registration>? Registrations;
    private FrozenDictionary<Type, Registration>? FrozenRegistrations;
    private List<object>? Disposables;
    private HashSet<string>? Forbidden;
    private Dictionary<Type, string>? ContextByToken;
    private Dictionary<string, string>? ContextHints;

    [ThreadStatic]
    private static List<Type>? BuildChain;

    public DiContainer() {
        Parent = null;
        Root = this;
        Shared = new ConcurrentDictionary<Type, object>();
        BuildLock = new object();
    }

    private DiContainer(DiContainer parent) {
        Parent = parent;
        Root = parent.Root;
    }

    public DiContainer Value<T>(T instance) {
        ArgumentNullException.ThrowIfNull(instance);
        SetLocal(typeof(T), instance);
        return this;
    }

    public DiContainer Singleton<T>(Func<DiContainer, T> factory) => Register<T>(Lifetime.Singleton, factory);

    public DiContainer Scoped<T>(Func<DiContainer, T> factory) => Register<T>(Lifetime.Scoped, factory);

    public DiContainer Transient<T>(Func<DiContainer, T> factory) => Register<T>(Lifetime.Transient, factory);

    private DiContainer Register<T>(Lifetime lifetime, Func<DiContainer, T> factory) {
        ArgumentNullException.ThrowIfNull(factory);
        if (Parent is not null)
            throw new InvalidOperationException("Cannot register services on a scope; register them on the root container.");

        (Registrations ??= [])[typeof(T)] = new Registration(lifetime, container => factory(container)!);
        FrozenRegistrations = null;
        return this;
    }

    public T Get<T>() => (T)Resolve(typeof(T));

    public object Get(Type type) {
        ArgumentNullException.ThrowIfNull(type);
        return Resolve(type);
    }

    public bool Has<T>() => Has(typeof(T));

    public bool Has(Type type) {
        ArgumentNullException.ThrowIfNull(type);
        for (DiContainer? c = this; c is not null; c = c.Parent) {
            if (c.TryGetLocal(type, out _))
                return true;
            if (c.TryGetRegistration(type, out _))
                return true;
        }

        return false;
    }

    public DiContainer Scope() => new(this);

    public DiContainer Start() {
        if (Parent is not null)
            throw new InvalidOperationException("Start applies to the root container.");

        if (Registrations is null)
            return this;

        FrozenRegistrations = Registrations.ToFrozenDictionary();
        foreach (var (key, registration) in Registrations) {
            if (registration.Lifetime == Lifetime.Singleton)
                Resolve(key);
        }

        return this;
    }

    public DiContainer ContextTokens(string name, IEnumerable<Type> tokens, string? hint = null) {
        var root = Root;
        root.ContextByToken ??= [];
        foreach (var token in tokens)
            root.ContextByToken[token] = name;

        if (hint is not null) {
            root.ContextHints ??= [];
            root.ContextHints[name] = hint;
        }

        return this;
    }

    public DiContainer Forbid(string name) {
        Forbidden ??= [];
        Forbidden.Add(name);
        return this;
    }

    public DiContainer NoHttp() => Forbid("http");

    public async ValueTask DisposeAsync() {
        Shared?.Clear();
        Local?.Clear();

        if (Disposables is not null) {
            for (var i = Disposables.Count - 1; i >= 0; i--) {
                switch (Disposables[i]) {
                    case IAsyncDisposable async:
                        await async.DisposeAsync();
                        break;
                    case IDisposable sync:
                        sync.Dispose();
                        break;
                }
            }

            Disposables.Clear();
        }
    }

    private object Resolve(Type key) {
        GuardContext(key);

        for (DiContainer? c = this; c is not null; c = c.Parent) {
            if (c.TryGetLocal(key, out var cached))
                return cached;
        }

        Registration? found = null;
        for (DiContainer? c = this; c is not null; c = c.Parent) {
            if (c.TryGetRegistration(key, out var registration)) {
                found = registration;
                break;
            }
        }

        if (found is null)
            throw new UnboundTokenException(Describe(key));

        var reg = found.Value;
        return reg.Lifetime switch {
            Lifetime.Singleton => Root.BuildCached(key, reg.Factory),
            Lifetime.Scoped => BuildScoped(key, reg.Factory),
            _ => Build(key, reg.Factory, this),
        };
    }

    private object BuildScoped(Type key, Func<DiContainer, object> factory) {
        if (Parent is null)
            throw new ScopeRequiredException(Describe(key));
        return BuildCached(key, factory);
    }

    private object BuildCached(Type key, Func<DiContainer, object> factory) {
        if (TryGetLocal(key, out var existing))
            return existing;

        if (Shared is null) {
            var scoped = Build(key, factory, this);
            SetLocal(key, scoped);
            Remember(scoped);
            return scoped;
        }

        lock (BuildLock!) {
            if (TryGetLocal(key, out existing))
                return existing;

            var instance = Build(key, factory, this);
            SetLocal(key, instance);
            Remember(instance);
            return instance;
        }
    }

    private object Build(Type key, Func<DiContainer, object> factory, DiContainer resolver) {
        var chain = BuildChain ??= [];
        if (chain.Contains(key)) {
            var cycle = new List<string>(chain.Count + 1);
            foreach (var link in chain)
                cycle.Add(Describe(link));
            cycle.Add(Describe(key));
            throw new CircularDependencyException(cycle);
        }

        chain.Add(key);
        try {
            return factory(resolver);
        } finally {
            chain.RemoveAt(chain.Count - 1);
        }
    }

    private void Remember(object instance) {
        if (instance is IAsyncDisposable or IDisposable)
            (Disposables ??= []).Add(instance);
    }

    private void GuardContext(Type key) {
        var context = Root.ContextByToken?.GetValueOrDefault(key);
        if (context is null || !Forbids(context))
            return;

        var chain = BuildChain;
        var names = new List<string>((chain?.Count ?? 0) + 1);
        if (chain is not null) {
            foreach (var link in chain)
                names.Add(Describe(link));
        }

        names.Add(Describe(key));
        throw new ForbiddenDependencyException(context, names, Root.ContextHints?.GetValueOrDefault(context));
    }

    private bool Forbids(string context) {
        for (DiContainer? c = this; c is not null; c = c.Parent) {
            if (c.Forbidden?.Contains(context) == true)
                return true;
        }

        return false;
    }

    private bool TryGetLocal(Type key, out object value) {
        if (Shared is not null)
            return Shared.TryGetValue(key, out value!);
        if (Local is not null)
            return Local.TryGetValue(key, out value!);
        value = null!;
        return false;
    }

    private void SetLocal(Type key, object value) {
        if (Shared is not null)
            Shared[key] = value;
        else
            (Local ??= [])[key] = value;
    }

    private bool TryGetRegistration(Type key, out Registration registration) {
        var frozen = FrozenRegistrations;
        if (frozen is not null)
            return frozen.TryGetValue(key, out registration);
        if (Registrations is not null)
            return Registrations.TryGetValue(key, out registration);
        registration = default;
        return false;
    }

    private static string Describe(Type type) => type.Name;
}
