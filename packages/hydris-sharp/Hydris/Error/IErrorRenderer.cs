using Hydris.Http;

namespace Hydris.Error;

public interface IErrorRenderer {
    Reply Render(Exception error, Request request, bool json);
}
