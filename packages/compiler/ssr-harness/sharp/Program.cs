using Hydris.Http;

CookieAuthority.Secret("harness-secret");

var app = new Hydris.App();

await app.Serve(int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "5000"));
