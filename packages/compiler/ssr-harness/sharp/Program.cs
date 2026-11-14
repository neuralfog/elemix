using Hydris.Http;

CookieAuthority.Secret("harness-secret");

var app = new Hydris.App();
app.EnableCsrf(new CsrfOptions { Secure = false });
app.EnableCsp(new CspOptions { EnvFile = "csp.env" });
app.EnableSecurityHeaders(new SecurityHeadersOptions { EnvFile = "security.env" });

await app.Serve(int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "5000"));
