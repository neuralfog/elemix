using System.Text;
using Hydris.Container;
using Hydris.Http;
using Hydris.Middleware;

namespace Hydris.Tests;

public sealed class PipelineTests {
    private sealed class Recorder {
        public List<string> Log { get; } = [];
    }

    private sealed class First(Recorder recorder) : IMiddleware {
        public async Task<Reply> Handle(Next next) {
            recorder.Log.Add("first:before");
            var reply = await next();
            recorder.Log.Add("first:after");
            return reply;
        }
    }

    private sealed class Second(Recorder recorder) : IMiddleware {
        public async Task<Reply> Handle(Next next) {
            recorder.Log.Add("second:before");
            var reply = await next();
            recorder.Log.Add("second:after");
            return reply;
        }
    }

    private sealed class ShortCircuit : IMiddleware {
        public Task<Reply> Handle(Next next) => Task.FromResult(Reply.Text("blocked").Status(401));
    }

    private sealed class AddHeader : IMiddleware {
        public async Task<Reply> Handle(Next next) => (await next()).Header("X-Test", "on");
    }

    [Fact]
    public async Task RunsMiddlewareInOrderAroundTheHandler() {
        var recorder = new Recorder();
        var container = new DiContainer();
        container.Value(recorder);
        container.Scoped(c => new First(c.Get<Recorder>()));
        container.Scoped(c => new Second(c.Get<Recorder>()));
        var scope = container.Scope();

        var reply = await Pipeline.Run(scope, [typeof(First), typeof(Second)], () => {
            recorder.Log.Add("handler");
            return Task.FromResult(Reply.Text("ok"));
        });

        Assert.Equal(
            ["first:before", "second:before", "handler", "second:after", "first:after"],
            recorder.Log);
        Assert.Equal("ok", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public async Task MiddlewareCanShortCircuit() {
        var container = new DiContainer();
        container.Scoped(_ => new ShortCircuit());
        var scope = container.Scope();
        var handlerRan = false;

        var reply = await Pipeline.Run(scope, [typeof(ShortCircuit)], () => {
            handlerRan = true;
            return Task.FromResult(Reply.Text("ok"));
        });

        Assert.False(handlerRan);
        Assert.Equal(401, reply.StatusCode);
        Assert.Equal("blocked", Encoding.UTF8.GetString(reply.Content));
    }

    [Fact]
    public async Task MiddlewareCanModifyTheReplyAfterNext() {
        var container = new DiContainer();
        container.Scoped(_ => new AddHeader());
        var scope = container.Scope();

        var reply = await Pipeline.Run(scope, [typeof(AddHeader)], () => Task.FromResult(Reply.Text("ok")));

        Assert.Equal("on", reply.HeaderValue("X-Test"));
    }

    [Fact]
    public async Task EmptyPipelineRunsTheHandlerDirectly() {
        var scope = new DiContainer().Scope();

        var reply = await Pipeline.Run(scope, [], () => Task.FromResult(Reply.Text("ok")));

        Assert.Equal("ok", Encoding.UTF8.GetString(reply.Content));
    }
}
