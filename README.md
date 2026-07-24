# Covas

Covas 是一个面向 Codex 的单图标注 widget 插件。在当前会话里打开标注画布，圈图、画箭头、写备注，提交后带标注的截图自动发回对话流。

## 功能

- 在 Codex 中打开原生标注画布 widget，支持矩形框、箭头、自由笔、文本气泡
- 标注状态自动保存到 `.covas-sessions/`，关闭或重启不丢失
- 同一张图的不同变体可平铺切换，标注跟随版本保留
- 直接拖拽本地图片进入画布
- 通过 MCP 工具读取会话状态、保存进度、提交标注结果

## 安装

### 让 Codex 自动安装

把下面这段发给 Codex：

```
请从 https://github.com/sevenking0213-bit/covas.git 安装 Covas Codex 插件。
请 clone 仓库到 ~/.codex/plugins/covas，确认 .codex-plugin/plugin.json 存在，
把插件加入 personal marketplace，先运行 codex plugin marketplace add ~，
再运行 codex plugin add covas@personal。
安装后请告诉我是否需要开启新对话来加载 MCP 工具。
```

### 手动安装

```bash
mkdir -p ~/.codex/plugins
git clone https://github.com/sevenking0213-bit/covas.git ~/.codex/plugins/covas
cd ~/.codex/plugins/covas && npm install && npm run build
```

确保 `~/.agents/plugins/marketplace.json` 中有 Covas 条目：

```json
{
  "name": "personal",
  "interface": {
    "displayName": "Personal"
  },
  "plugins": [
    {
      "name": "covas",
      "source": {
        "source": "local",
        "path": "./plugins/covas"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

然后注册 marketplace 并安装插件：

```bash
codex plugin marketplace add ~
codex plugin add covas@personal
```

## 使用

### 打开标注画布

在 Codex 中说：

```
请打开 Covas 标注画布。
```

Covas 会通过 `render_covas_workspace_widget` 在当前会话里渲染画布 widget。

### 提交标注

1. 在画布中对图片做标注（矩形框、箭头、文本等）
2. 点击 **提交标注**，Covas 会把带标注的截图和会话状态发回对话流
3. Codex 会根据标注内容继续处理

### 保存会话状态

Covas 会在 `.covas-sessions/` 目录下自动保存会话进度，下次打开时恢复。

## 本地开发

```bash
npm install
npm run build
npm run test
```

---

## 开发者

sevenking  
sevenking0213@gmail.com

## 致谢

Covas 的画布标注核心基于 [Konva](https://github.com/konvajs/konva) 开源框架构建。
