# UNNC AlgoLab

UNNC AlgoLab 是一款用于学习和练习算法的伪代码编辑器和解释器。它提供桌面编辑环境，可以编写、运行伪代码并查看输出和变量。

## 功能

- 多标签编辑 `.algo` 和 `.txt` 文件，支持新建、打开、保存和重命名；已有路径的文件支持自动保存。
- 伪代码语法高亮、诊断提示和自动缩进，可选择 2、4 或 8 个空格。
- 运行算法并提供入口函数参数，查看运行结果、输出和变量。
- 支持停止运行，以及递归、条件、循环和部分列表与树操作。
- 使用 `⌘J`（macOS）或 `Ctrl+J`（Windows）显示或隐藏输出和变量面板。

解释器实现的是项目支持的伪代码语法，并非通用编程语言。可在应用启动时查看内置的 Fibonacci 示例，或参考 [伪代码语法规则](docs/PSEUDOCODE_SYNTAX.md) 和 [解释器测试](tests/interpreter.test.mjs)。

## 环境要求

- Node.js 22.12 或更新版本，以及 npm。
- Rust 和 Cargo。
- Tauri 所需的系统依赖：macOS 需要 Xcode 命令行工具；Windows 需要 Microsoft C++ Build Tools 和 WebView2。Windows ARM64 还需要对应的 MSVC ARM64 工具。

具体安装方法参见 [Tauri 环境准备文档](https://v2.tauri.app/start/prerequisites/)。

## 开始使用

克隆仓库并安装依赖：

```bash
git clone https://github.com/HarleyZHOUzzz/UNNC-AlgoLab.git
cd UNNC-AlgoLab
npm install
```

启动桌面开发版：

```bash
npm run tauri dev
```

在 Windows PowerShell 中，如果执行策略阻止 `npm.ps1`，可使用 `npm.cmd install` 和 `npm.cmd run tauri dev`。

仅预览前端界面时，可以运行 `npm run dev` 并打开终端显示的地址。原生文件操作和桌面菜单需要在 Tauri 应用中测试。

## 使用示例

1. 在编辑器中编写或打开算法，例如：

   ```text
   Algorithm: F(n)
   Requires: non-negative integer n
   Returns: the n-th Fibonacci number
   if n == 0 or n == 1 then
     return n
   else
     return F(n - 1) + F(n - 2)
   endif
   ```

2. 点击运行按钮，在弹出的对话框中输入函数调用，例如 `F(10)`。
3. 在右侧面板查看运行结果和变量。

## 构建与测试

```bash
# 检查 TypeScript 并构建前端
npm run build

# 运行解释器测试
npm run test:interpreter

# 构建桌面应用
npm run tauri build
```

桌面应用需要在目标平台配置好 Tauri 构建依赖。构建结果位于 `src-tauri/target/` 下。

## 技术栈

- [Tauri 2](https://v2.tauri.app/) 和 Rust
- React、TypeScript 和 Vite
- CodeMirror 6
