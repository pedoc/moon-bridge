import "./wasm_exec.js";
import { createRuntimeContext, loadModule } from "./runtime.mjs";

let mod, go, instance;
let initPromise = null;
const binding = {};

async function initWasm(ctx) {
  mod = await loadModule();
  go = new Go();
  let ready;
  initPromise = new Promise((resolve) => { ready = resolve; });
  globalThis.context = ctx;
  instance = new WebAssembly.Instance(mod, {
    ...go.importObject,
    workers: { ready: () => { ready(); } },
  });
  go.run(instance, ctx);
}

async function ensureReady(ctx) {
  if (initPromise === null) initWasm(ctx);
  await initPromise;
}

async function fetch(req, env, execCtx) {
  await ensureReady(createRuntimeContext({ env, ctx: execCtx, binding }));
  console.error("[worker] calling handleRequest"); try { try {
    const _result = await binding.handleRequest(req);
    if (_result instanceof Response) return _result;
    console.error('[worker] bad result:', typeof _result, _result);
    return new Response('bad result', {status: 500});
  } catch (e) {
    console.error('[worker] throw:', e);
    return new Response('throw', {status: 500});
  } } catch(e) { console.error("[worker] handleRequest error:", e); return new Response("error", {status:500}); }
}

async function scheduled(event, env, execCtx) {
  await ensureReady(createRuntimeContext({ env, ctx: execCtx, binding }));
  return binding.runScheduler(event);
}

async function queue(batch, env, execCtx) {
  await ensureReady(createRuntimeContext({ env, ctx: execCtx, binding }));
  return binding.handleQueueMessageBatch(batch);
}

export default { fetch, scheduled, queue };
