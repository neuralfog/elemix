using Hydris.Http;
using Hydris.Sample;

CookieAuthority.Secret("dev-secret");

var app = new Hydris.App();

app.Use<RequestId>();
app.Use<PoweredBy>();

await app.Serve();
