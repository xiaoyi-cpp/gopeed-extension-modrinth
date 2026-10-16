// ── 假的 gopeed 环境 ──
const SETTINGS = JSON.parse(process.env.TEST_SETTINGS || "{}");
let resolveFn = null;

globalThis.gopeed = {
  logger: {
    debug: (s) => { if (process.env.TEST_DEBUG) console.log("  [debug] " + s); },
    info:  (s) => console.log("  [info ] " + s),
    warn:  (s) => console.log("  [warn ] " + s),
    error: (s) => console.log("  [error] " + s),
  },
  settings: SETTINGS,
  storage: { get: () => null, set: () => {} },
  events: { onResolve: (fn) => { resolveFn = fn; } },
};

// ── 载入扩展 ──
require("./index.js");

// ── 跑 ──
(async () => {
  const url = process.argv[2];
  console.log("=== 测试 URL: " + url);
  const ctx = { req: { url: url }, res: null };
  try {
    await resolveFn(ctx);
    console.log("");
    console.log("=== 解析结果 ===");
    console.log("任务名: " + ctx.res.name);
    console.log("文件数: " + ctx.res.files.length);
    ctx.res.files.slice(0, 10).forEach((f, i) => {
      console.log("  " + (i + 1) + ". " + f.name);
      console.log("     " + f.req.url);
    });
    if (ctx.res.files.length > 10) console.log("  ... 还有 " + (ctx.res.files.length - 10) + " 个");
  } catch (e) {
    console.log("");
    console.log("=== 出错 ===");
    console.log("  " + e.message);
    process.exitCode = 1;
  }
})();