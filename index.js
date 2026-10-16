// ══════════════════════════════════════════════════════════════
//  Modrinth 下载器 —— Gopeed 扩展
//
//  用法：在 Gopeed 里用这些链接创建任务
//     https://modrinth.com/mod/sodium
//     https://modrinth.com/mod/sodium/versions
//     https://modrinth.com/plugin/xxx
//     https://modrinth.com/resourcepack/xxx
//     https://modrinth.com/shader/xxx
//     https://modrinth.com/modpack/xxx
//     https://modrinth.com/datapack/xxx
//
//  ★ 环境是 goja（纯 Go 的 JS 解释器）
//     · 有 fetch，没有浏览器/Node 的 API
//     · ★★ 没有 URL 类 —— 所以下面全是字符串处理
//     · 支持 async/await
// ══════════════════════════════════════════════════════════════

var API = "https://api.modrinth.com/v2";
var UA  = "xiaoyi/gopeed-extension-modrinth/1.0.0";

// Modrinth 的项目类型（URL 第一段就是它）
var TYPES = ["mod", "plugin", "datapack", "shader", "resourcepack", "modpack"];

// ─────────────────────────────────────────
//  从 URL 里抠出 type 和 slug
//  输入: https://modrinth.com/mod/sodium/versions
//  输出: { type: "mod", slug: "sodium", version: "" }
// ─────────────────────────────────────────
function parseUrl(u) {
  // 去掉协议和域名
  var s = u.replace(/^https?:\/\//i, "");
  var slash = s.indexOf("/");
  if (slash < 0) return null;
  var path = s.substring(slash + 1);        // mod/sodium/versions

  // 去掉查询串和锚点
  path = path.split("?")[0].split("#")[0];

  // 拆成段，去掉空的
  var parts = [];
  var segs = path.split("/");
  for (var i = 0; i < segs.length; i++) {
    if (segs[i]) parts.push(decodeURIComponent(segs[i]));
  }
  if (parts.length < 2) return null;

  var type = parts[0].toLowerCase();
  if (TYPES.indexOf(type) < 0) return null;

  var out = { type: type, slug: parts[1], version: "" };
  // .../version/<版本号>
  if (parts.length >= 4 && parts[2].toLowerCase() === "version") {
    out.version = parts[3];
  }
  return out;
}

// ─────────────────────────────────────────
//  带 UA 的 fetch + JSON
// ─────────────────────────────────────────
async function getJson(url) {
  gopeed.logger.debug("GET " + url);
  var r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) {
    throw new Error("API " + r.status + " " + url);
  }
  return await r.json();
}

// ─────────────────────────────────────────
//  主逻辑
// ─────────────────────────────────────────
gopeed.events.onResolve(async (ctx) => {
  var url = ctx.req.url;
  gopeed.logger.info("Modrinth 下载器被调用: " + url);

  // ── ① 解析 URL ──
  var info = parseUrl(url);
  if (!info) {
    throw new Error("不认识的 Modrinth 链接: " + url);
  }
  gopeed.logger.info("类型=" + info.type + "  slug=" + info.slug +
                     (info.version ? ("  版本=" + info.version) : ""));

  // ── ② 项目信息（拿标题，用于任务名）──
  var project = await getJson(API + "/project/" + encodeURIComponent(info.slug));
  gopeed.logger.info("项目: " + project.title + "   下载量 " + project.downloads);

  // ── ③ 版本列表（带过滤）──
  var qs = [];
  var loader = (gopeed.settings.loader || "").trim();
  var gv = (gopeed.settings.gameVersion || "").trim();
  // ★★★ 必须 URL 编码 —— goja 的 fetch 不会自动处理方括号和引号
  //     不编码的话 Modrinth 会返回 400
  if (loader) qs.push("loaders=" + encodeURIComponent('["' + loader + '"]'));
  if (gv)     qs.push("game_versions=" + encodeURIComponent('["' + gv + '"]'));

  var vurl = API + "/project/" + encodeURIComponent(info.slug) + "/version";
  if (qs.length) vurl += "?" + qs.join("&");

  var versions = await getJson(vurl);
  if (!versions || versions.length === 0) {
    throw new Error("没找到匹配的版本（loader=" + loader + " gameVersion=" + gv + "）");
  }
  gopeed.logger.info("匹配到 " + versions.length + " 个版本");

  // ── ④ 指定了版本号就只留那一个 ──
  if (info.version) {
    var only = [];
    for (var i = 0; i < versions.length; i++) {
      if (versions[i].version_number === info.version || versions[i].id === info.version) {
        only.push(versions[i]);
      }
    }
    if (only.length === 0) {
      throw new Error("指定的版本没找到: " + info.version);
    }
    versions = only;
  }

  // ── ⑤ 是否包含测试版 ──
  if (!gopeed.settings.includeBeta) {
    var rel = [];
    for (var j = 0; j < versions.length; j++) {
      if (versions[j].version_type === "release") rel.push(versions[j]);
    }
    if (rel.length > 0) versions = rel;
    else gopeed.logger.warn("没有 release 版本 —— 那就用 beta/alpha 了");
  }

  // ── ⑥ 只要最新版 ──
  if (gopeed.settings.latestOnly) {
    versions = [versions[0]];
  }
  gopeed.logger.info("最终解析 " + versions.length + " 个版本");

  // ── ⑦ 拼文件列表 ──
  var proxy = (gopeed.settings.useProxy || "").trim();
  var files = [];
  for (var k = 0; k < versions.length; k++) {
    var v = versions[k];
    for (var m = 0; m < v.files.length; m++) {
      var f = v.files[m];
      // ★ 只要主文件（有些版本还带 sources.jar 之类）
      if (v.files.length > 1 && !f.primary) continue;

      var dl = f.url;
      if (proxy) dl = proxy + dl;

      files.push({
        name: f.filename,
        req: { url: dl }
      });
      gopeed.logger.debug("  + " + f.filename + "  " + Math.round(f.size / 1024) + " KB");
    }
  }

  if (files.length === 0) {
    throw new Error("没解析出文件");
  }

  // ── ⑧ 交给 Gopeed ──
  ctx.res = {
    name: project.title + " (" + info.slug + ")",
    files: files
  };
  gopeed.logger.info("解析完成: " + files.length + " 个文件");
});