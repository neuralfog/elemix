using Hydris.Http;

CookieAuthority.Secret("dev-secret");

var app = new Hydris.App();

app.Compression();
app.Assets("/static", "public/static");

await app.Serve();
