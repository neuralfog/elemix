using Hydris.Http;
using Hydris.Renderer;
using Hydris.Sample;

CookieAuthority.Secret("dev-secret");

var app = new Hydris.App();

// @Temp
app.UseRenderer(RendererKind.Bun);

app.Use<RequestId>();
app.Use<PoweredBy>();

await app.Serve();
