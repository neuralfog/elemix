namespace Hydris.Http;

public interface ICsrf {
    bool Verify();

    string Issue(Reply reply);
}
