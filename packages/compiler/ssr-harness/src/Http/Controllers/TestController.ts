import { Reply } from '@neuralfog/hydris/http';
import { AttrApp } from '../../../../fixtures/AttrApp';
import { BeforeMountApp } from '../../../../fixtures/BeforeMountApp';
import { BeforeMountStoreApp } from '../../../../fixtures/BeforeMountStoreApp';
import { BenchApp } from '../../../../fixtures/BenchApp';
import { CardListApp } from '../../../../fixtures/CardListApp';
import { ChatApp } from '../../../../fixtures/ChatApp';
import { ClientOnlyApp } from '../../../../fixtures/ClientOnlyApp';
import { ClassStateApp } from '../../../../fixtures/ClassStateApp';
import { CollectionApp } from '../../../../fixtures/CollectionApp';
import { ConditionalApp } from '../../../../fixtures/ConditionalApp';
import { CounterApp } from '../../../../fixtures/CounterApp';
import { CustomEventApp } from '../../../../fixtures/CustomEventApp';
import { DeepLeaf } from '../../../../fixtures/DeepInheritanceApp';
import { DocumentPageApp } from '../../../../fixtures/DocumentPageApp';
import { DeepStateApp } from '../../../../fixtures/DeepStateApp';
import { DerivedApp } from '../../../../fixtures/DerivedApp';
import { DirectApp } from '../../../../fixtures/DirectApp';
import { DynamicChildApp } from '../../../../fixtures/DynamicChildApp';
import { EffectApp } from '../../../../fixtures/EffectApp';
import { FormApp } from '../../../../fixtures/FormApp';
import { InheritDerived } from '../../../../fixtures/InheritanceApp';
import { InterpApp } from '../../../../fixtures/InterpApp';
import { LifecycleApp } from '../../../../fixtures/LifecycleApp';
import { LoremApp1k } from '../../../../fixtures/LoremApp1k';
import { LoremApp10k } from '../../../../fixtures/LoremApp10k';
import { LoremStyled1k } from '../../../../fixtures/LoremStyled1k';
import { LoremStyled10k } from '../../../../fixtures/LoremStyled10k';
import { LoremNested1k } from '../../../../fixtures/LoremNested1k';
import { LoremNested10k } from '../../../../fixtures/LoremNested10k';
import { MethodApp } from '../../../../fixtures/MethodApp';
import { MethodHelperApp } from '../../../../fixtures/MethodHelperApp';
import { MultiRootApp } from '../../../../fixtures/MultiRootApp';
import { MultiStateApp } from '../../../../fixtures/MultiStateApp';
import { NestedApp } from '../../../../fixtures/NestedApp';
import { NestedTemplateApp } from '../../../../fixtures/NestedTemplateApp';
import { NoShadowApp } from '../../../../fixtures/NoShadowApp';
import { PanelApp } from '../../../../fixtures/PanelApp';
import { RowList } from '../../../../fixtures/ParamHelper';
import { PragmaApp } from '../../../../fixtures/PragmaApp';
import { PrimitiveStateApp } from '../../../../fixtures/PrimitiveStateApp';
import { ProfileApp } from '../../../../fixtures/ProfileApp';
import { PropsApp } from '../../../../fixtures/PropsApp';
import { ProofDestructuring } from '../../../../fixtures/ProofDestructuring';
import { RatingInput } from '../../../../fixtures/RatingInput';
import { RawApp } from '../../../../fixtures/RawApp';
import { RefApp } from '../../../../fixtures/RefApp';
import { RenderApp } from '../../../../fixtures/RenderApp';
import { TitledNote } from '../../../../fixtures/SecondHelper';
import { SignalApp } from '../../../../fixtures/SignalApp';
import { SsrCycleApp } from '../../../../fixtures/SsrCycleApp';
import { SsrClientParent } from '../../../../fixtures/SsrClientParent';
import { ViewDataApp } from '../../../../fixtures/ViewDataApp';
import { ViewDataRichApp } from '../../../../fixtures/ViewDataRichApp';
import { ViewDataStoreApp } from '../../../../fixtures/ViewDataStoreApp';
import { SsrMixedApp } from '../../../../fixtures/SsrMixedApp';
import { SsrPropsAppClientChild } from '../../../../fixtures/SsrPropsAppClientChild';
import { SsrStoreApp } from '../../../../fixtures/SsrStoreApp';
import { StatusApp } from '../../../../fixtures/StatusApp';
import { StepperWidget } from '../../../../fixtures/StepperWidget';
import { StoreApp } from '../../../../fixtures/StoreApp';
import { StyleApp } from '../../../../fixtures/StyleApp';
import { SvgApp } from '../../../../fixtures/SvgApp';
import { TodoApp } from '../../../../fixtures/TodoApp';
import { FirstWidget } from '../../../../fixtures/TwoComponents';
import { ScssApp } from '../../../../fixtures/ScssApp';
import { MatchApp } from '../../../../fixtures/MatchApp';
import { ModelApp } from '../../../../fixtures/ModelApp';
import { ModelDeepApp } from '../../../../fixtures/ModelDeepApp';
import { ResetMixed } from '../../../../fixtures/ResetMixed';
import { ResetProbe } from '../../../../fixtures/ResetProbe';
import { ResetProbeLight } from '../../../../fixtures/ResetProbeLight';
import { ModelForwardApp } from '../../../../fixtures/ModelForwardApp';
import { SlotApp } from '../../../../fixtures/SlotApp';
import { SlotCard } from '../../../../fixtures/SlotCard';
import { WhenElseApp } from '../../../../fixtures/WhenElseApp';

export class TestController {
    counterApp(): Reply {
        return Reply.view(CounterApp);
    }

    documentPageApp(): Reply {
        return Reply.view(DocumentPageApp);
    }

    beforeMountApp(): Reply {
        return Reply.view(BeforeMountApp);
    }

    beforeMountStoreApp(): Reply {
        return Reply.view(BeforeMountStoreApp);
    }

    attrApp(): Reply {
        return Reply.view(AttrApp);
    }

    benchApp(): Reply {
        return Reply.view(BenchApp);
    }

    slotApp(): Reply {
        return Reply.view(SlotApp);
    }

    slotCard(): Reply {
        return Reply.view(SlotCard);
    }

    whenElseApp(): Reply {
        return Reply.view(WhenElseApp);
    }

    conditionalApp(): Reply {
        return Reply.view(ConditionalApp);
    }

    matchApp(): Reply {
        return Reply.view(MatchApp);
    }

    modelApp(): Reply {
        return Reply.view(ModelApp);
    }

    modelForwardApp(): Reply {
        return Reply.view(ModelForwardApp);
    }

    modelDeepApp(): Reply {
        return Reply.view(ModelDeepApp);
    }

    resetProbe(): Reply {
        return Reply.view(ResetProbe);
    }

    resetProbeLight(): Reply {
        return Reply.view(ResetProbeLight);
    }

    resetMixed(): Reply {
        return Reply.view(ResetMixed);
    }

    cardListApp(): Reply {
        return Reply.view(CardListApp);
    }

    chatApp(): Reply {
        return Reply.view(ChatApp);
    }

    clientOnlyApp(): Reply {
        return Reply.view(ClientOnlyApp);
    }

    classStateApp(): Reply {
        return Reply.view(ClassStateApp);
    }

    collectionApp(): Reply {
        return Reply.view(CollectionApp);
    }

    customEventApp(): Reply {
        return Reply.view(CustomEventApp);
    }

    deepInheritanceApp(): Reply {
        return Reply.view(DeepLeaf);
    }

    deepStateApp(): Reply {
        return Reply.view(DeepStateApp);
    }

    derivedApp(): Reply {
        return Reply.view(DerivedApp);
    }

    directApp(): Reply {
        return Reply.view(DirectApp);
    }

    dynamicChildApp(): Reply {
        return Reply.view(DynamicChildApp);
    }

    effectApp(): Reply {
        return Reply.view(EffectApp);
    }

    formApp(): Reply {
        return Reply.view(FormApp);
    }

    inheritanceApp(): Reply {
        return Reply.view(InheritDerived);
    }

    interpApp(): Reply {
        return Reply.view(InterpApp);
    }

    scssApp(): Reply {
        return Reply.view(ScssApp);
    }

    methodApp(): Reply {
        return Reply.view(MethodApp);
    }

    methodHelperApp(): Reply {
        return Reply.view(MethodHelperApp);
    }

    multiRootApp(): Reply {
        return Reply.view(MultiRootApp);
    }

    lifecycleApp(): Reply {
        return Reply.view(LifecycleApp);
    }

    loremApp1k(): Reply {
        return Reply.view(LoremApp1k);
    }

    loremApp10k(): Reply {
        return Reply.view(LoremApp10k);
    }

    loremStyled1k(): Reply {
        return Reply.view(LoremStyled1k);
    }

    loremStyled10k(): Reply {
        return Reply.view(LoremStyled10k);
    }

    loremNested1k(): Reply {
        return Reply.view(LoremNested1k);
    }

    loremNested10k(): Reply {
        return Reply.view(LoremNested10k);
    }

    multiStateApp(): Reply {
        return Reply.view(MultiStateApp);
    }

    nestedApp(): Reply {
        return Reply.view(NestedApp);
    }

    nestedTemplateApp(): Reply {
        return Reply.view(NestedTemplateApp);
    }

    noShadowApp(): Reply {
        return Reply.view(NoShadowApp);
    }

    panelApp(): Reply {
        return Reply.view(PanelApp);
    }

    paramHelper(): Reply {
        return Reply.view(RowList);
    }

    pragmaApp(): Reply {
        return Reply.view(PragmaApp);
    }

    primitiveStateApp(): Reply {
        return Reply.view(PrimitiveStateApp);
    }

    profileApp(): Reply {
        return Reply.view(ProfileApp);
    }

    propsApp(): Reply {
        return Reply.view(PropsApp);
    }

    proofDestructuring(): Reply {
        return Reply.view(ProofDestructuring);
    }

    ratingInput(): Reply {
        return Reply.view(RatingInput);
    }

    rawApp(): Reply {
        return Reply.view(RawApp);
    }

    refApp(): Reply {
        return Reply.view(RefApp);
    }

    renderApp(): Reply {
        return Reply.view(RenderApp);
    }

    secondHelper(): Reply {
        return Reply.view(TitledNote);
    }

    signalApp(): Reply {
        return Reply.view(SignalApp);
    }

    ssrCycleApp(): Reply {
        return Reply.view(SsrCycleApp);
    }

    ssrMixedApp(): Reply {
        return Reply.view(SsrMixedApp);
    }

    ssrClientParent(): Reply {
        return Reply.view(SsrClientParent);
    }

    viewDataApp(): Reply {
        return Reply.view(ViewDataApp, {
            title: 'Hello viewData',
            user: { name: 'Ada' },
            count: 3,
        });
    }

    viewDataStoreApp(): Reply {
        return Reply.view(ViewDataStoreApp, { start: 5 });
    }

    viewDataRichApp(): Reply {
        return Reply.view(ViewDataRichApp, {
            str: 'hello',
            num: 42,
            bool: true,
            nil: null,
            tags: ['a', 'b', 'c'],
            scores: [1, 2, 3, 4],
            obj: { a: 'x', b: 7 },
            nested: { deep: { value: 'buried' } },
            rows: [
                { id: 1, label: 'one' },
                { id: 2, label: 'two' },
            ],
        });
    }

    ssrPropsAppClientChild(): Reply {
        return Reply.view(SsrPropsAppClientChild);
    }

    ssrStoreApp(): Reply {
        return Reply.view(SsrStoreApp);
    }

    statusApp(): Reply {
        return Reply.view(StatusApp);
    }

    stepperWidget(): Reply {
        return Reply.view(StepperWidget);
    }

    storeApp(): Reply {
        return Reply.view(StoreApp);
    }

    styleApp(): Reply {
        return Reply.view(StyleApp);
    }

    svgApp(): Reply {
        return Reply.view(SvgApp);
    }

    todoApp(): Reply {
        return Reply.view(TodoApp);
    }

    twoComponents(): Reply {
        return Reply.view(FirstWidget);
    }
}
