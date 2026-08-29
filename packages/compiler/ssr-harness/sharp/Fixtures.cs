using Hydris.Container;
using Hydris.Http;
using Hydris.Routing;

namespace Hydris.Harness;

[ViewData]
public sealed partial record NavData(string Title, string Page);

[ViewData]
public sealed partial record VUser(string Name);

[ViewData]
public sealed partial record VData(string Title, VUser User, int Count);

[ViewData]
public sealed partial record StartData(int Start);

[ViewData]
public sealed partial record RichObj(string A, int B);

[ViewData]
public sealed partial record RichDeep(string Value);

[ViewData]
public sealed partial record RichNested(RichDeep Deep);

[ViewData]
public sealed partial record RichRow(int Id, string Label);

[ViewData]
public sealed partial record RichData(
    string Str, int Num, bool Bool, string? Nil,
    string[] Tags, int[] Scores, RichObj Obj, RichNested Nested, RichRow[] Rows);

[Handler]
public sealed class Fixtures {
    [Get("/nav-redirect")]
    public Reply NavRedirect() => Reply.Redirect("/nav-about-app");

    [Get("/nav-home-app")]
    public Reply NavHomeApp() => Reply.View("fixtures/NavHomeApp", new NavData("Home", "home"));

    [Get("/nav-about-app")]
    public Reply NavAboutApp() => Reply.View("fixtures/NavAboutApp", new NavData("About", "about"));

    [Get("/view-data-app")]
    public Reply ViewDataApp() =>
        Reply.View("fixtures/ViewDataApp", new VData("Hello viewData", new VUser("Ada"), 3));

    [Get("/view-data-store-app")]
    public Reply ViewDataStoreApp() =>
        Reply.View("fixtures/ViewDataStoreApp", new StartData(5));

    [Get("/view-data-rich-app")]
    public Reply ViewDataRichApp() => Reply.View("fixtures/ViewDataRichApp", new RichData(
        "hello", 42, true, null,
        ["a", "b", "c"], [1, 2, 3, 4],
        new RichObj("x", 7),
        new RichNested(new RichDeep("buried")),
        [new RichRow(1, "one"), new RichRow(2, "two")]));


    [Get("/counter-app")]
    public Reply CounterApp() => Reply.View("fixtures/CounterApp");

    [Get("/nav-store-a")]
    public Reply NavStoreAApp() => Reply.View("fixtures/NavStoreAApp");

    [Get("/nav-store-b")]
    public Reply NavStoreBApp() => Reply.View("fixtures/NavStoreBApp");

    [Get("/nav-state-a")]
    public Reply NavStateAApp() => Reply.View("fixtures/NavStateAApp");

    [Get("/nav-state-b")]
    public Reply NavStateBApp() => Reply.View("fixtures/NavStateBApp");

    [Get("/document-page-app")]
    public Reply DocumentPageApp() => Reply.View("fixtures/DocumentPageApp");

    [Get("/before-mount-app")]
    public Reply BeforeMountApp() => Reply.View("fixtures/BeforeMountApp");

    [Get("/before-mount-store-app")]
    public Reply BeforeMountStoreApp() => Reply.View("fixtures/BeforeMountStoreApp");

    [Get("/attr-app")]
    public Reply AttrApp() => Reply.View("fixtures/AttrApp");

    [Get("/bench-app")]
    public Reply BenchApp() => Reply.View("fixtures/BenchApp");

    [Get("/slot-app")]
    public Reply SlotApp() => Reply.View("fixtures/SlotApp");

    [Get("/slot-card")]
    public Reply SlotCard() => Reply.View("fixtures/SlotCard");

    [Get("/icon-button-app")]
    public Reply IconButtonApp() => Reply.View("fixtures/IconButtonApp");

    [Get("/twin-list-app")]
    public Reply TwinListApp() => Reply.View("fixtures/TwinListApp");

    [Get("/multi-root-row-app")]
    public Reply MultiRootRowApp() => Reply.View("fixtures/MultiRootRowApp");

    [Get("/when-else-app")]
    public Reply WhenElseApp() => Reply.View("fixtures/WhenElseApp");

    [Get("/conditional-app")]
    public Reply ConditionalApp() => Reply.View("fixtures/ConditionalApp");

    [Get("/match-app")]
    public Reply MatchApp() => Reply.View("fixtures/MatchApp");

    [Get("/model-app")]
    public Reply ModelApp() => Reply.View("fixtures/ModelApp");

    [Get("/model-forward-app")]
    public Reply ModelForwardApp() => Reply.View("fixtures/ModelForwardApp");

    [Get("/model-deep-app")]
    public Reply ModelDeepApp() => Reply.View("fixtures/ModelDeepApp");

    [Get("/reset-probe")]
    public Reply ResetProbe() => Reply.View("fixtures/ResetProbe");

    [Get("/reset-probe-light")]
    public Reply ResetProbeLight() => Reply.View("fixtures/ResetProbeLight");

    [Get("/reset-mixed")]
    public Reply ResetMixed() => Reply.View("fixtures/ResetMixed");

    [Get("/card-list-app")]
    public Reply CardListApp() => Reply.View("fixtures/CardListApp");

    [Get("/chat-app")]
    public Reply ChatApp() => Reply.View("fixtures/ChatApp");

    [Get("/client-only-app")]
    public Reply ClientOnlyApp() => Reply.View("fixtures/ClientOnlyApp");

    [Get("/class-state-app")]
    public Reply ClassStateApp() => Reply.View("fixtures/ClassStateApp");

    [Get("/collection-app")]
    public Reply CollectionApp() => Reply.View("fixtures/CollectionApp");

    [Get("/custom-event-app")]
    public Reply CustomEventApp() => Reply.View("fixtures/CustomEventApp");

    [Get("/deep-inheritance-app")]
    public Reply DeepLeaf() => Reply.View("fixtures/DeepInheritanceApp@DeepLeaf");

    [Get("/deep-state-app")]
    public Reply DeepStateApp() => Reply.View("fixtures/DeepStateApp");

    [Get("/derived-app")]
    public Reply DerivedApp() => Reply.View("fixtures/DerivedApp");

    [Get("/direct-app")]
    public Reply DirectApp() => Reply.View("fixtures/DirectApp");

    [Get("/dynamic-child-app")]
    public Reply DynamicChildApp() => Reply.View("fixtures/DynamicChildApp");

    [Get("/effect-app")]
    public Reply EffectApp() => Reply.View("fixtures/EffectApp");

    [Get("/form-app")]
    public Reply FormApp() => Reply.View("fixtures/FormApp");

    [Get("/inheritance-app")]
    public Reply InheritDerived() => Reply.View("fixtures/InheritanceApp@InheritDerived");

    [Get("/interp-app")]
    public Reply InterpApp() => Reply.View("fixtures/InterpApp");

    [Get("/scss-app")]
    public Reply ScssApp() => Reply.View("fixtures/ScssApp");

    [Get("/method-app")]
    public Reply MethodApp() => Reply.View("fixtures/MethodApp");

    [Get("/method-helper-app")]
    public Reply MethodHelperApp() => Reply.View("fixtures/MethodHelperApp");

    [Get("/multi-root-app")]
    public Reply MultiRootApp() => Reply.View("fixtures/MultiRootApp");

    [Get("/lifecycle-app")]
    public Reply LifecycleApp() => Reply.View("fixtures/LifecycleApp");

    [Get("/lorem-app1k")]
    public Reply LoremApp1k() => Reply.View("fixtures/LoremApp1k");

    [Get("/lorem-app10k")]
    public Reply LoremApp10k() => Reply.View("fixtures/LoremApp10k");

    [Get("/lorem-styled1k")]
    public Reply LoremStyled1k() => Reply.View("fixtures/LoremStyled1k");

    [Get("/lorem-styled10k")]
    public Reply LoremStyled10k() => Reply.View("fixtures/LoremStyled10k");

    [Get("/lorem-nested1k")]
    public Reply LoremNested1k() => Reply.View("fixtures/LoremNested1k");

    [Get("/lorem-nested10k")]
    public Reply LoremNested10k() => Reply.View("fixtures/LoremNested10k");

    [Get("/multi-state-app")]
    public Reply MultiStateApp() => Reply.View("fixtures/MultiStateApp");

    [Get("/nested-app")]
    public Reply NestedApp() => Reply.View("fixtures/NestedApp");

    [Get("/nested-template-app")]
    public Reply NestedTemplateApp() => Reply.View("fixtures/NestedTemplateApp");

    [Get("/no-shadow-app")]
    public Reply NoShadowApp() => Reply.View("fixtures/NoShadowApp");

    [Get("/panel-app")]
    public Reply PanelApp() => Reply.View("fixtures/PanelApp");

    [Get("/param-helper")]
    public Reply RowList() => Reply.View("fixtures/ParamHelper@RowList");

    [Get("/pragma-app")]
    public Reply PragmaApp() => Reply.View("fixtures/PragmaApp");

    [Get("/primitive-state-app")]
    public Reply PrimitiveStateApp() => Reply.View("fixtures/PrimitiveStateApp");

    [Get("/profile-app")]
    public Reply ProfileApp() => Reply.View("fixtures/ProfileApp");

    [Get("/props-app")]
    public Reply PropsApp() => Reply.View("fixtures/PropsApp");

    [Get("/proof-destructuring")]
    public Reply ProofDestructuring() => Reply.View("fixtures/ProofDestructuring");

    [Get("/rating-input")]
    public Reply RatingInput() => Reply.View("fixtures/RatingInput");

    [Get("/raw-app")]
    public Reply RawApp() => Reply.View("fixtures/RawApp");

    [Get("/ref-app")]
    public Reply RefApp() => Reply.View("fixtures/RefApp");

    [Get("/render-app")]
    public Reply RenderApp() => Reply.View("fixtures/RenderApp");

    [Get("/second-helper")]
    public Reply TitledNote() => Reply.View("fixtures/SecondHelper@TitledNote");

    [Get("/signal-app")]
    public Reply SignalApp() => Reply.View("fixtures/SignalApp");

    [Get("/ssr-cycle-app")]
    public Reply SsrCycleApp() => Reply.View("fixtures/SsrCycleApp");

    [Get("/ssr-mixed-app")]
    public Reply SsrMixedApp() => Reply.View("fixtures/SsrMixedApp");

    [Get("/ssr-client-parent")]
    public Reply SsrClientParent() => Reply.View("fixtures/SsrClientParent");

    [Get("/ssr-props-app-client-child")]
    public Reply SsrPropsAppClientChild() => Reply.View("fixtures/SsrPropsAppClientChild");

    [Get("/ssr-store-app")]
    public Reply SsrStoreApp() => Reply.View("fixtures/SsrStoreApp");

    [Get("/status-app")]
    public Reply StatusApp() => Reply.View("fixtures/StatusApp");

    [Get("/stepper-widget")]
    public Reply StepperWidget() => Reply.View("fixtures/StepperWidget");

    [Get("/store-app")]
    public Reply StoreApp() => Reply.View("fixtures/StoreApp");

    [Get("/style-app")]
    public Reply StyleApp() => Reply.View("fixtures/StyleApp");

    [Get("/svg-app")]
    public Reply SvgApp() => Reply.View("fixtures/SvgApp");

    [Get("/todo-app")]
    public Reply TodoApp() => Reply.View("fixtures/TodoApp");

    [Get("/two-components")]
    public Reply FirstWidget() => Reply.View("fixtures/TwoComponents@FirstWidget");

}
