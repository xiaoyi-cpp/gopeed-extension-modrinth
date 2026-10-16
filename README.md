# Gopeed 扩展：Modrinth 下载器

把 [Modrinth](https://modrinth.com) 的项目页面解析成 Gopeed 下载任务。

## 为什么做这个

在浏览器里点 Modrinth 的下载按钮，一次只能下一个文件，
而且要自己记住"我的游戏版本是什么、用什么加载器"。

这个扩展让你**直接把项目页面地址粘进 Gopeed**，
它按你配置的版本和加载器自动挑出正确的那个文件。

## 支持的项目类型

| 类型 | URL 例子 |
|---|---|
| mod | `https://modrinth.com/mod/sodium` |
| 插件 | `https://modrinth.com/plugin/xxx` |
| 数据包 | `https://modrinth.com/datapack/xxx` |
| 光影 | `https://modrinth.com/shader/complementary-reimagined` |
| 资源包 | `https://modrinth.com/resourcepack/fresh-animations` |
| 整合包 | `https://modrinth.com/modpack/xxx` |

带 `/versions` 后缀、或带 `?查询串` 都能正常解析。
指定某个版本：`https://modrinth.com/mod/sodium/version/mc1.21.1-0.8.13-fabric`

## 设置项

| 名称 | 说明 |
|---|---|
| 游戏版本 | 例如 `1.21.1`。留空 = 不过滤 |
| 加载器 | `fabric` / `forge` / `neoforge` / `quilt`。留空 = 不过滤 |
| 只下最新版 | 开着 = 只解析最新一个版本 |
| 包含测试版 | 关着 = 只要 release 版（跳过 beta/alpha） |
| 下载代理前缀 | 可选，例如 `https://gh-proxy.com/` |

**推荐配置**：`游戏版本 = 你玩的版本`，`加载器 = 你用的加载器`，`只下最新版 = 开`。
这样粘一个项目地址，直接就是你要的那个 jar。

## 安装

**方式一：从仓库安装**

在 Gopeed 扩展页输入：

```
https://github.com/xiaoyi-cpp/gopeed-extension-modrinth
```

**方式二：开发者模式**（改代码时用）

1. Gopeed 扩展页，**连续点 5 次「安装」按钮**
2. 点按钮，选择本项目的目录
3. 改完 `index.js` 后重新解析即可生效

## 本地测试

扩展脚本跑在 [goja](https://github.com/dop251/goja) 里（纯 Go 的 JS 解释器），
和 Node 的 fetch 行为不完全一样。

`_test.js` 是个脚手架，用假的 `gopeed` 对象在 Node 里跑同一份代码：

```bash
# 默认设置
TEST_SETTINGS='{"latestOnly":true}' node _test.js https://modrinth.com/mod/sodium

# 指定 fabric + 1.21.1
TEST_SETTINGS='{"latestOnly":true,"loader":"fabric","gameVersion":"1.21.1"}' \
  node _test.js https://modrinth.com/mod/sodium
```

## 踩过的坑

**goja 的 fetch 不会自动 URL 编码。**

Modrinth 的过滤参数长这样：

```
loaders=["fabric"]&game_versions=["1.21.1"]
```

在 Node 里直接拼进 URL 能work（fetch 会自动编码方括号和引号），
但 goja 不会，原样发过去 **Modrinth 会返回 400**。

必须手动编码：

```js
qs.push("loaders=" + encodeURIComponent('["' + loader + '"]'));
```

## 使用的 API

- `GET https://api.modrinth.com/v2/project/{slug}` — 项目信息
- `GET https://api.modrinth.com/v2/project/{slug}/version` — 版本列表
  - 可选参数：`loaders`、`game_versions`（都是 JSON 数组格式，要 URL 编码）

详见 [Modrinth API 文档](https://docs.modrinth.com/)。

## 许可

MIT