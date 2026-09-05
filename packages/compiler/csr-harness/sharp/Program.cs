using Hydris.Harness;
using Hydris.Http;

CookieAuthority.Secret("csr-harness-secret");

var app = new Hydris.App();
app.Assets("/csr", Path.Combine(AppContext.BaseDirectory, "csr"));

var bundles = CsrBundles.Load(Path.Combine(AppContext.BaseDirectory, "csr"));

app.Routes.Get<Request>("/view/:tag", request => {
    var tag = request.Param("tag");
    var src = tag is null ? null : bundles.Resolve(tag);
    if (tag is null || src is null)
        return Reply.Text("unknown component").Status(404);

    return Reply.Html(
        $"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>{tag}</title></head>"
        + $"<body><{tag}></{tag}><script type=\"module\" src=\"{src}\"></script></body></html>");
});

await app.Serve(int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "5000"));
