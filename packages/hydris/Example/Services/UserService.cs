using Hydris.Container;

namespace Hydris.Example.Services;

[Singleton]
public sealed class UserService {
    public string Find(string id) => $"user #{id}: Ada Lovelace";
}
