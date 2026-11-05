# UNNC AlgoLab

UNNC AlgoLab 是一款用于学习和练习算法的伪代码编辑器和解释器。它提供桌面编辑环境，可以编写、运行伪代码并查看输出和变量。

## 功能

- 多标签编辑 `.algo` 和 `.txt` 文件，支持拖动标签排序、新建、打开、保存和重命名；已有路径的文件支持自动保存。
- 打开文件夹后，在侧边栏浏览子文件夹和其中的 `.algo` 文件；可新建文件夹或手动刷新列表。
- 伪代码语法高亮、诊断提示和自动缩进，可选择 2、4 或 8 个空格。
- 运行算法并提供入口函数参数，查看运行结果、输出和变量。
- 支持停止运行，以及递归、条件、循环和部分列表与树操作。
- 顶部搜索框支持工作区文件查找、命令执行、算法导航和代码内容搜索。
- 使用 `⌘J`（macOS）或 `Ctrl+J`（Windows）显示或隐藏输出和变量面板。

解释器实现的是项目支持的伪代码语法，并非通用编程语言。可参考下方的 Fibonacci 示例、[伪代码语法规则](docs/PSEUDOCODE_SYNTAX.md) 和 [解释器测试](tests/interpreter.test.mjs)。

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

# 验证工作区文件合并、算法导航和内容匹配
npm run test:search

# 构建桌面应用
npm run tauri build
```

桌面应用需要在目标平台配置好 Tauri 构建依赖。构建结果位于 `src-tauri/target/` 下。

### 顶部搜索框

按 `⌘P`（macOS）或 `Ctrl+P`（Windows）打开搜索框，使用方向键选择结果、回车打开、Esc 关闭：

| 输入 | 功能 |
| --- | --- |
| 文件名或相对路径 | 查找已打开文件及当前文件夹中的 `.algo` 文件，包括子文件夹和尚未打开的文件 |
| `>命令` | 查找并执行保存、运行、调整缩进等命令 |
| `:行号` | 跳转到当前文件的指定行 |
| `@算法名` | 查找当前文件中的算法和子算法；只输入 `@` 可列出全部算法 |
| `#算法名` | 在已打开文件及当前文件夹中查找算法 |
| `%文字` | 搜索已打开文件及当前文件夹中的代码内容 |

内容搜索不区分大小写，按原始文本匹配，每次最多显示 200 条结果。已打开文件优先使用编辑器中的当前内容，包含未保存的修改。算法和内容匹配支持点击定位；读取失败的文件会提示并跳过。磁盘上新增的文件需要先刷新文件树。

### macOS 测试包

macOS 配置默认使用临时签名（`signingIdentity: "-"`），用于保证测试应用包的签名完整性。临时签名不能证明开发者身份，也不能替代 Apple 公证；从网络下载的应用仍可能被 Gatekeeper 阻止。

面向其他用户分发时，需要将 `src-tauri/tauri.macos.conf.json` 的签名身份改为有效的 Developer ID Application 证书，并配置 Apple 公证凭据，重新打包和验证。

### Windows 安装器

Windows 使用 NSIS 生成安装程序。安装向导提供安装目录选择；默认仅为当前用户安装。安装界面支持简体中文和英文，并根据系统语言选择。

安装后的应用信息中发布者为 Yinxi ZHOU。安装程序目前未进行代码签名，因此 Windows 安全提示中的发布者可能显示为未知；该提示需要有效的代码签名证书才能验证身份。

在 Windows 项目目录中安装依赖后运行：

```powershell
npm.cmd ci
npm.cmd run tauri -- build --bundles nsis
```

安装程序位于 `src-tauri\target\release\bundle\nsis\`。如果通过 `--target aarch64-pc-windows-msvc` 指定 ARM64 目标，输出路径为 `src-tauri\target\aarch64-pc-windows-msvc\release\bundle\nsis\`。Parallels 中的 Windows ARM 虚拟机应使用 ARM64 版本；普通 Intel / AMD Windows 电脑使用 x64 版本。构建需要相应架构的 Rust MSVC 工具链、Visual C++ 生成工具和 Windows SDK。

也可以在 GitHub 的 Actions 页面手动运行 **Build Windows NSIS installer**，完成后从该次运行的 Artifacts 下载对应架构的安装程序。该流程仅构建和上传工作流产物，不会自动发布 Release；工作流需要先提交到仓库。安装器尚未配置代码签名。

### Microsoft Store MSIX

商店包需要先在 Partner Center 创建应用并获取 **Package/Identity name** 和完整的 **Publisher**（`CN=...`）。这两项必须与商店中的应用身份完全一致，不要用显示名称或自签名证书的名称代替。商店包使用四段数字版本：第一段不能为 0，第四段必须为 0，例如 `1.1.11.0`；它与软件显示的 `0.1.0-beta` 是分别管理的版本。

在 GitHub Actions 手动运行 **Build Windows Store MSIX**，输入包名、Publisher 和数字版本。工作流分别在 Windows x64 和 ARM64 构建应用、使用 Windows SDK 的 MakeAppx 创建 MSIX，并将两个包作为工作流产物保存。它不会自动提交到 Microsoft Store，也不会发布到官网。

也可以在安装了 Node.js、Rust、Python 和 Windows SDK 的 Windows 电脑上，先使用 `npm.cmd ci` 安装依赖，再构建对应的应用：

```powershell
npm.cmd run tauri -- build --no-bundle --target aarch64-pc-windows-msvc
python scripts/package_msix.py --package-name '<Partner Center 包名>' --publisher '<Partner Center 的完整 Publisher>' --version '1.1.11.0' --arch arm64 --exe 'src-tauri/target/aarch64-pc-windows-msvc/release/unnc-algolab.exe' --output 'store-packages/UNNC-AlgoLab-arm64.msix'
```

x64 版本使用目标 `x86_64-pc-windows-msvc`、`--arch x64` 和对应目录。脚本会验证架构及商店版本格式；若 SDK 工具无法自动找到，可用 `--makeappx` 指定路径。`store-packages/` 是构建输出，不应提交到代码仓库。

这些包用于 **Partner Center 商店提交**，脚本不会自签名或将证书加入系统信任。商店会在应用通过认证后签署分发包；本地直接安装需要单独使用受测试设备信任的证书签名。包声明 `runFullTrust`，提交时需接受商店审核；WebView2 Runtime 及应用的文件、窗口功能仍需在干净 Windows 设备上验证。当前 Defender 对旧 NSIS 安装器的检测也应继续向微软核查，不能假定 MSIX 会解决该检测。

## 技术栈

- [Tauri 2](https://v2.tauri.app/) 和 Rust
- React、TypeScript 和 Vite
- CodeMirror 6
