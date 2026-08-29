#include <stdint.h>
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

uint8_t *hq_bytecode(void *handle, const char *code, int *outLen) {
    HqEngine *e = (HqEngine *)handle;
    JS_UpdateStackTop(e->rt);
    JSValue compiled = JS_Eval(e->ctx, code, strlen(code), "<bundle>",
                               JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(compiled)) {
        JS_FreeValue(e->ctx, JS_GetException(e->ctx));
        JS_FreeValue(e->ctx, compiled);
        *outLen = 0;
        return NULL;
    }
    size_t size = 0;
    uint8_t *buf = JS_WriteObject(e->ctx, &size, compiled, JS_WRITE_OBJ_BYTECODE);
    JS_FreeValue(e->ctx, compiled);
    if (!buf) {
        *outLen = 0;
        return NULL;
    }
    uint8_t *out = malloc(size);
    memcpy(out, buf, size);
    js_free(e->ctx, buf);
    *outLen = (int)size;
    return out;
}

char *hq_load_bytecode(void *handle, const uint8_t *bytecode, int len) {
    HqEngine *e = (HqEngine *)handle;
    JS_FreeContext(e->ctx);
    e->ctx = JS_NewContext(e->rt);
    JS_UpdateStackTop(e->rt);
    JSValue compiled = JS_ReadObject(e->ctx, bytecode, (size_t)len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(compiled)) {
        JSValue ex = JS_GetException(e->ctx);
        const char *s = JS_ToCString(e->ctx, ex);
        char *err = strdup(s ? s : "bytecode read error");
        if (s) {
            JS_FreeCString(e->ctx, s);
        }
        JS_FreeValue(e->ctx, ex);
        JS_FreeValue(e->ctx, compiled);
        return err;
    }
    JSValue v = JS_EvalFunction(e->ctx, compiled);
    char *err = NULL;
    if (JS_IsException(v)) {
        JSValue ex = JS_GetException(e->ctx);
        const char *s = JS_ToCString(e->ctx, ex);
        err = strdup(s ? s : "bytecode eval error");
        if (s) {
            JS_FreeCString(e->ctx, s);
        }
        JS_FreeValue(e->ctx, ex);
    }
    JS_FreeValue(e->ctx, v);
    return err;
}

char *hq_render(void *handle, const char *dataJson, int *outLen) {
    HqEngine *e = (HqEngine *)handle;
    JS_UpdateStackTop(e->rt);
    JSValue global = JS_GetGlobalObject(e->ctx);
    JSValue fn = JS_GetPropertyStr(e->ctx, global, "render");

    JSValue result;
    if (dataJson && dataJson[0]) {
        JSValue data = JS_ParseJSON(e->ctx, dataJson, strlen(dataJson), "<viewdata>");
        result = JS_Call(e->ctx, fn, global, 1, &data);
        JS_FreeValue(e->ctx, data);
    } else {
        result = JS_Call(e->ctx, fn, global, 0, NULL);
    }

    JS_FreeValue(e->ctx, fn);
    JS_FreeValue(e->ctx, global);

    char *out = stringify(e->ctx, result, outLen);
    JS_FreeValue(e->ctx, result);
    return out;
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
