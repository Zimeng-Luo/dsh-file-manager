# DSH File Manager · 共享资料库

DeepSeek Harness 原生插件。在左侧导航的「插件 / 自动化任务 / 上下文洞察」同级区域新增「资料库」，点击后在主区域打开独立页面。

支持配置资料目录、上传文件、创建笔记、列表与预览、下载原件，以及通过模型工具把资料存入共享库并在其他会话中检索。资料库独立于工作区，代码项目不需要搬到资料库目录。

## 安装

需要 Node.js 22.19+，接口参照 DeepSeek Harness 0.2.1-rc.2。仓库包含预构建浏览器入口，不需要额外运行构建脚本。

桌面版：

~~~powershell
dsh plugin --profile desktop add github:Zimeng-Luo/dsh-file-manager#main
~~~

Web 版：

~~~powershell
dsh plugin --profile web add github:Zimeng-Luo/dsh-file-manager#main
~~~

安装后重启 Harness，点击左侧「资料库」，填写例如 F:\Library 的绝对目录并保存。这个路径属于运行 Harness 的机器。若你在别的设备浏览网页，不代表可以直接填写浏览器设备的磁盘路径。

如果你使用源码启动，在 Harness 仓库中以 pnpm dsh 替换上述 dsh 命令。自定义 profile 使用其实际名称。

更新时先 remove dsh-file-manager 再 add 上述来源，之后重启。仅重启不会下载新代码。目录内资料与独立的设置文件不随包更新删除。

## 0.1.1：后端接口 404 修复

后端接口独立于模型工具、文件系统和提示词服务启动。工具服务稍后出现时自动注册；复制来源文件时使用调用会话的文件系统。SQLite 在打开资料库时才加载，运行时缺少 SQLite 不再阻止整个后端导入。已保存目录打不开时，页面显示具体错误，并允许重新选择目录恢复。

如果装过旧版，需要重新下载安装后重启，刷新页面不会更新插件：

~~~powershell
dsh plugin --profile desktop remove dsh-file-manager
dsh plugin --profile desktop add github:Zimeng-Luo/dsh-file-manager#main
~~~

## 怎么使用

在会话中直接说：

- 「把这个附件存入资料库，标记为产品资料。」
- 「把 H:\Projects\demo\README.md 存入资料库。」
- 「把刚才的方案保存成资料库笔记，标题是网站改版方案。」
- 在另一个会话说：「找一下之前保存的网站改版方案，并阅读原文。」

插件同时安装模型工具与 skills/library/SKILL.md 的使用说明；说明会由插件加入系统提示，无需手工复制 skill。模型必须实际调用工具后，才会发生保存或检索。

| 工具 | 用途 |
| --- | --- |
| library_status | 查看资料库配置与当前目录 |
| library_store | 复制已有文件，或保存文字笔记 |
| library_list | 分页列出资料 |
| library_search | 搜索名称、标题、描述、标签和已解析正文 |
| library_read | 根据 ID 分段读取正文 |
| library_refresh | 登记手动放入目录的文件，更新外部变化 |

保存原文件使用 sourcePath；保存生成的文字使用 content，两者只能选一个。来源文件通过会话的 ctx.fs 读取， relative path 使用该会话当前工作目录。保存成功后，原件已经复制到资料库；来源保持原位置。

例如直接调用工具：

~~~json
{
  "sourcePath": "H:\\Projects\\demo\\README.md",
  "title": "网站项目说明",
  "description": "项目架构与启动步骤",
  "tags": ["网站", "开发"]
}
~~~

检索结果返回资料 ID、完整路径、SHA-256、原文片段及字符范围。继续用 library_read 阅读；nextOffset 表示还有后续文字。textTruncated 表示正文只索引了前一部分。

## 页面与存储

页面提供目录设置、多文件上传、笔记编辑、文件列表、关键词搜索、文本预览和下载。会话中刚存入的文件会随页面的定时刷新显示。手动复制进目录的文件可点击「刷新目录」登记；启动时也扫描一次。

默认存储：

~~~text
F:\Library\
  files\<资料ID>\<原文件名>
  .dsh-library\index.sqlite
~~~

同名文件使用不同 ID 目录，互不覆盖。所有格式的普通文件都可入库并按文件名和元数据搜索。PDF、DOCX 及常见文本格式支持正文解析；解析失败保留文件并显示状态。扫描图片 PDF 无可提取文字时显示无文字状态。当前没有 OCR、向量检索或音视频转写。

解析与索引在本地执行，不调用远程模型 API。agent 阅读工具返回的文字时，这些文字会进入你使用的模型上下文。

## 配置

通过页面保存的目录优先于 cordis 配置的默认目录。配置 overlay 示例：

~~~yaml
- id: dsh-file-manager
  config:
    directory: 'F:\Library'
    stateDir: 'F:\AgentData\library-settings'
    maxFileBytes: 33554432
    maxTextChars: 1000000
    chunkChars: 2400
    maxScanFiles: 20000
    pollIntervalMs: 5000
~~~

保存为 library.patch.yml，以 dsh web --patch library.patch.yml 启动；桌面版通过其 profile 配置应用同样的 patch。

- directory：首次默认目录，须为 Host 上的绝对路径。
- stateDir：设置文件目录。默认 DSH_HOME/integrations/file-manager；未设置 DSH_HOME 时使用用户目录下 .dsh/integrations/file-manager。
- maxFileBytes：单个导入、上传、下载与正文解析上限，默认 32 MiB。较大的手动放入文件只登记元数据。
- maxTextChars：每文件最多索引的字符数。
- chunkChars：正文检索片段长度。
- maxScanFiles：一次目录扫描的文件上限，达到时报告 capped，不能把结果当成完整发现。
- pollIntervalMs：页面读取共享索引的间隔，至少 1000 毫秒，默认 5000。

切换目录会打开该目录独立的资料索引，原目录仍保留。目录选择保存在 stateDir/settings.json。要恢复配置文件的默认目录，先备份并移除这个设置文件。

这是一个明确授权目标目录的共享存储能力，不会扩大项目的通用文件或 shell 权限；本版不提供任意磁盘管理或删除工具。

## 微信 / QQ · dsh-im

将插件安装到机器人实际连接的 Harness 实例和 profile。资料库工具必须在机器人的 Agent Preset 中可见；若预设有工具白名单，加入 library_*。

当你要求保存收到的附件时，模型可将 dsh-im 提供的附件路径传给 library_store，复制成功的长期原件不受聊天附件保留期影响。共享库不绑定原会话，其他会话可继续检索。

本版不修改 dsh-im，也不会无条件归档每一份聊天附件。更换 dsh-im 的 Agent Preset 后，需要 /new 才创建使用新预设的会话。资料库是实例内共享存储，调用者范围沿用你的 Harness 与 dsh-im 入口配置。

## 开发与验证

~~~sh
npm install
npm run check
npm pack
~~~

npm run check 检查预构建入口与源码同步，并运行存储、跨会话/重启检索、路径限制、中文检索、真实 PDF/DOCX 解析、模型工具、原生导航注册和 React 页面交互测试。

GitHub Actions 配置 Windows / Linux、Node.js 24 两个平台；通过后生成可下载的 tgz 安装包。以仓库 Actions 的实际结果为准。自动测试不等同于真实 DSH / Electron 界面的完整实机验收。

## 许可证

MIT
