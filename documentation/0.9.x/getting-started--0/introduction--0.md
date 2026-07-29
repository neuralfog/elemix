# Introduction

**Modern frontend has lost the plot.** A build tool to run the build tool. A
framework on top of a framework. Config files nobody reads.
Hundreds of dependencies to ship a form. Most of that complexity is not the
problem you set out to solve.

***elemix*** is one person's answer to that. One author, no committee, no roadmap sold
to a boardroom. A single project built to make working on the web simple again -
cut the stupid unnecessary complexity forced onto you.

Frontend is simple. Always was. You style rectangles, move them around the
screen now and then, sprinkle in some JavaScript. A frontend
developer should not need **ten PhDs** and a **rocket science degree** to put a simple
form and a button on a page. For something like that you do not even need a
framework.

Where frontend frameworks shine is the hard case - building highly interactive
applications. And yet **some** of them fail at exactly that. Worse, they get in
the way of the very thing they exist to do.

## Why I built it?

I built ***elemix*** for myself. The way I want to use it. Not for a market, not for
a star count. The tool I want to reach for, built the way I want to work. I also
want to sit at the top of the benchmarks 😂

If I got your attention and you are thinking of using it, I am flattered. If not,
I could not care less 🤷

## Key points

### State management

I want state management that does not suck and is easy to use. Reactivity and
state should not be a chore. A brainless decision, not a week of architecting
before you write a single line.

No **reducers**. No **context providers**. No **hooks**, no **composables**, no jumping on a
pogo stick. Here is my state - I set the value on a field and it works. No `setThis` or
`setThat` nonsense just to kick off a render update and the waterfall of garbage that follows after.

### Reactivity

Reactivity you never wire up. Read state in a template or an effect, ***elemix***
tracks it. Change it, the right thing re-runs. No dependency arrays. No subscribe
and unsubscribe. No signal getters and setters to remember - you read values and
write values, the framework keeps up.

You can invoke a render yourself. `this.render()` re-renders the component, no
reactive state required, you decide when. Full control.
A first-class feature, carefully planned from the beginning. One of my favourites 💙

### No framework

***elemix*** is a library, not a framework. Reactive elements and global state -
that is the whole surface. Nothing else to learn, no architecture handed down.
You decide how the app is put together.

Underneath, a reactive element is a standard Web Component, augmented. You build
on the platform, not on somebody's abstraction over it.


