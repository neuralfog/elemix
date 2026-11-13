using Hydris.Http;

CookieAuthority.Secret("harness-secret");

var app = new Hydris.App();
app.EnableCsrf(new CsrfOptions { Secure = false });

await app.Serve(int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "5000"));
