#include <stdlib.h>
#include <string.h>
#include "quickjs.h"

typedef struct {
    JSRuntime *rt;
    JSContext *ctx;
} HqEngine;

void *hq_new(void) {
    HqEngine *e = malloc(sizeof(HqEngine));
    e->rt = JS_NewRuntime();
    e->ctx = JS_NewContext(e->rt);
    return e;
}

void *hq_compile(void *handle, const char *code) {
    HqEngine *e = (HqEngine *)handle;
    JS_UpdateStackTop(e->rt);
    JSValue fn = JS_Eval(e->ctx, code, strlen(code), "<template>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(fn)) {
        JS_FreeValue(e->ctx, JS_GetException(e->ctx));
        JS_FreeValue(e->ctx, fn);
        return NULL;
    }
    JSValue *slot = malloc(sizeof(JSValue));
    *slot = fn;
    return slot;
}

static char *stringify(JSContext *ctx, JSValue value, int *outLen) {
    int failed = JS_IsException(value);
    JSValue src = failed ? JS_GetException(ctx) : value;

    size_t n = 0;
    const char *s = JS_ToCStringLen(ctx, &n, src);
    size_t prefix = failed ? 6 : 0;

    char *out = malloc(prefix + n + 1);
    if (failed) {
        memcpy(out, "ERROR:", 6);
    }
    if (s) {
        memcpy(out + prefix, s, n);
        JS_FreeCString(ctx, s);
    }

    if (failed) {
        JS_FreeValue(ctx, src);
    }
    *outLen = (int)(prefix + n);
    return out;
}

char *hq_call(void *handle, void *fnSlot, const char *argsJson, int *outLen) {
    HqEngine *e = (HqEngine *)handle;
    JS_UpdateStackTop(e->rt);
    JSValue fn = *(JSValue *)fnSlot;

    JSValue args = JS_ParseJSON(e->ctx, argsJson, strlen(argsJson), "<args>");
    JSValue lenValue = JS_GetPropertyStr(e->ctx, args, "length");
    int argc = 0;
    JS_ToInt32(e->ctx, &argc, lenValue);
    JS_FreeValue(e->ctx, lenValue);

    JSValue *argv = argc > 0 ? malloc(sizeof(JSValue) * argc) : NULL;
    for (int i = 0; i < argc; i++) {
        argv[i] = JS_GetPropertyUint32(e->ctx, args, (uint32_t)i);
    }

    JSValue result = JS_Call(e->ctx, fn, JS_UNDEFINED, argc, argv);

    for (int i = 0; i < argc; i++) {
        JS_FreeValue(e->ctx, argv[i]);
    }
    free(argv);
    JS_FreeValue(e->ctx, args);

    char *out = stringify(e->ctx, result, outLen);
    JS_FreeValue(e->ctx, result);
    return out;
}

void hq_free_fn(void *handle, void *fnSlot) {
    HqEngine *e = (HqEngine *)handle;
    JS_FreeValue(e->ctx, *(JSValue *)fnSlot);
    free(fnSlot);
}

long long hq_memory(void *handle) {
    HqEngine *e = (HqEngine *)handle;
    JSMemoryUsage usage;
    JS_ComputeMemoryUsage(e->rt, &usage);
    return usage.malloc_size;
}

void hq_free(char *s) {
    free(s);
}

void hq_close(void *handle) {
    HqEngine *e = (HqEngine *)handle;
    JS_FreeContext(e->ctx);
    JS_FreeRuntime(e->rt);
    free(e);
}
