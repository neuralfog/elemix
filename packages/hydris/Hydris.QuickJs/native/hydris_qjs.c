#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "quickjs.h"
#include "mimalloc.h"

typedef struct {
    JSRuntime *rt;
    JSContext *ctx;
    const char *pendingCstr;
    char *pendingBuf;
} HqEngine;

static void *hq_mi_calloc(void *opaque, size_t count, size_t size) {
    return mi_calloc(count, size);
}

static void *hq_mi_malloc(void *opaque, size_t size) {
    return mi_malloc(size);
}

static void hq_mi_free(void *opaque, void *ptr) {
    mi_free(ptr);
}

static void *hq_mi_realloc(void *opaque, void *ptr, size_t size) {
    return mi_realloc(ptr, size);
}

static size_t hq_mi_usable_size(const void *ptr) {
    return mi_usable_size((void *)ptr);
}

static const JSMallocFunctions hq_malloc_funcs = {
    hq_mi_calloc,
    hq_mi_malloc,
    hq_mi_free,
    hq_mi_realloc,
    hq_mi_usable_size,
};

void *hq_new(void) {
    HqEngine *e = malloc(sizeof(HqEngine));
    e->rt = JS_NewRuntime2(&hq_malloc_funcs, NULL);
    e->ctx = JS_NewContext(e->rt);
    e->pendingCstr = NULL;
    e->pendingBuf = NULL;
    return e;
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

    if (!JS_IsException(result)) {
        size_t n = 0;
        const char *s = JS_ToCStringLen(e->ctx, &n, result);
        JS_FreeValue(e->ctx, result);
        e->pendingCstr = s;
        *outLen = (int)n;
        return (char *)s;
    }

    JSValue exc = JS_GetException(e->ctx);
    size_t n = 0;
    const char *s = JS_ToCStringLen(e->ctx, &n, exc);
    char *buf = malloc(6 + n + 1);
    memcpy(buf, "ERROR:", 6);
    if (s) {
        memcpy(buf + 6, s, n);
        JS_FreeCString(e->ctx, s);
    }
    buf[6 + n] = 0;
    JS_FreeValue(e->ctx, exc);
    JS_FreeValue(e->ctx, result);
    e->pendingBuf = buf;
    *outLen = (int)(6 + n);
    return buf;
}

void hq_free_render(void *handle) {
    HqEngine *e = (HqEngine *)handle;
    if (e->pendingCstr) {
        JS_FreeCString(e->ctx, e->pendingCstr);
        e->pendingCstr = NULL;
    }
    if (e->pendingBuf) {
        free(e->pendingBuf);
        e->pendingBuf = NULL;
    }
}

void hq_free(char *s) {
    free(s);
}

void hq_close(void *handle) {
    HqEngine *e = (HqEngine *)handle;
    hq_free_render(e);
    JS_FreeContext(e->ctx);
    JS_FreeRuntime(e->rt);
    free(e);
}
