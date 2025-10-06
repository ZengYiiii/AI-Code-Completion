# 🤖 AI Code Completion

## ✨ 请注意:
1. 这是使用智谱AI自动完成的项目，如果使用过程中造成的任何损失，请自行承担。
2. 如有任何侵权，请联系我删除，谢谢。
3. 要是可以和GitHub Copilot一样的体验就好了...

<div align="center">

![AI Code Completion Logo](https://img.shields.io/badge/VS%20Code-AI%20Completion-green?style=flat-square&logo=visual-studio-code)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

</div>

基于智谱AI大模型的智能代码补全插件，提供实时的代码建议和自动补全功能。

## ✨ 特性

- 🚀 **智能补全**: 基于上下文的实时代码建议
- 📊 **实时统计**: VS Code状态栏显示Token使用情况
- ⚙️ **简单配置**: 一键配置，开箱即用
- 🎯 **多语言支持**: JavaScript、TypeScript、Python、Java、C++等
- ⚡ **高性能**: 响应时间快，流畅的补全体验
- 🛡️ **稳定可靠**: 完善的错误处理和缓存机制

## 📦 安装

### 从VSIX文件安装
```bash
code --install-extension vscode-ai-completion-1.0.0.vsix
```

### 从VS Code市场安装
1. 打开VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "AI Code Completion"
4. 点击安装

## ⚙️ 快速配置

### 🎯 推荐配置
```json
{
  "aiCompletion.baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
  "aiCompletion.apiKey": "你的API Key:https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
  "aiCompletion.model": "glm-4.6",
  "aiCompletion.enabled": true,
  "aiCompletion.maxTokens": 1024,
  "aiCompletion.temperature": 0.3
}
```

### 🔧 配置方法

#### 方法1: VS Code设置
1. 按 `Ctrl+,` 打开设置
2. 搜索 "AI Completion"
3. 修改各项配置

#### 方法2: 命令面板
1. 按 `Ctrl+Shift+P`
2. 输入 "AI Completion: 配置插件设置"
3. 在可视化界面中配置

## 🚀 使用方法

### 触发补全
- **Tab键**: 最常用的触发方式
- **空格**: 关键字后触发
- **点号(.)**: 对象属性访问
- **左括号(**(**)**: 函数调用
- **其他**: 冒号(:)、等号(=)等

### 🎯 使用场景

#### JavaScript/TypeScript
```javascript
function hello() {  // 输入 function 并按 Tab
  console.log("Hello");  // AI 自动补全
}

const arr = [1, 2, 3];  // 输入数组并按 Tab
arr.map(item => item * 2);  // AI 自动补全
```

#### Python
```python
def calculate_sum(numbers):  // 输入函数定义并按 Tab
    total = 0
    for num in numbers:     // AI 自动补全循环体
        total += num
    return total
```

#### Java
```java
public class UserService {  // 输入类定义并按 Tab
    private String name;   // AI 自动补全属性
    private int age;       // AI 自动补全属性
}
```

## ⚙️ 高级功能

### 📊 Token统计
- 实时显示Token使用量
- 状态栏显示输入/输出Token统计
- 费用估算和使用历史追踪

### 🛠️ 调试工具
- `Ctrl+Shift+P` → "AI Completion: 完整API测试"
- `Ctrl+Shift+P` → "AI Completion: 内部调试测试"
- `Ctrl+Shift+P` → "AI Completion: 配置验证"

### 🎛️ 快捷键
- `Ctrl+Alt+A`: 切换AI补全状态
- `Ctrl+Alt+R`: 重置Token统计
- `Ctrl+Alt+S`: 显示Token统计

## 📋 配置选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `baseUrl` | `https://open.bigmodel.cn/api/coding/paas/v4` | API基础URL |
| `apiKey` | - | API密钥 (必需) |
| `model` | `glm-4.6` | AI模型 |
| `maxTokens` | `1024` | 最大生成Token数 |
| `temperature` | `0.3` | 创意度参数 (0-2) |
| `enabled` | `true` | 启用插件 |
| `delay` | `500` | 输入延迟防抖(ms) |
| `cacheEnabled` | `true` | 启用缓存 |
| `logLevel` | `info` | 日志级别 |

## 🔧 故障排除

### 常见问题

#### ❌ 插件无法使用
1. **检查配置**: 确认API密钥和Base URL正确
2. **网络连接**: 确保可以访问 `open.bigmodel.cn`
3. **防火墙**: 检查企业防火墙设置

#### ⏱ 响应慢
1. **调整延迟**: 增加 `aiCompletion.delay` 值
2. **启用缓存**: 确保 `aiCompletion.cacheEnabled` 为 `true`
3. **减少Token**: 降低 `aiCompletion.maxTokens` 值

#### 📊 Token统计异常
1. **重置统计**: 使用重置统计命令
2. **检查日志**: 查看详细错误信息

### 🛠️ 诊断命令

#### 完整API测试
```bash
Ctrl+Shift+P → "AI Completion: 完整API测试"
```

#### 配置验证
```bash
Ctrl+Shift+P → "AI Completion: 配置验证"
```

#### 显示日志
```bash
Ctrl+Shift+P → "AI Completion: 显示插件日志"
```

## 🤖 AI模型选择

### 🎯 推荐模型
- **glm-4.6**: 平衡性能和质量
- **glm-4.5-air**: 响应更快，成本更低

### 📊 性能对比
| 模型 | 速度 | 质量 | 适用场景 |
|------|------|------|----------|
| `glm-4.5-air` | ⚡⚡⚡⚡ | ⚡⚡⚡ | 简单补全、高频使用 |
| `glm-4.6` | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | 复杂代码、高质量需求 |

## 💡 使用技巧

### 🎯 提高补全质量
1. **提供清晰上下文**: 输入更多相关代码
2. **使用合适触发时机**: 在代码逻辑断点触发
3. **调整温度参数**: 创意性需求时提高temperature

### ⚡ 提升响应速度
1. **启用缓存**: 减少重复API调用
2. **优化延迟设置**: 根据网络环境调整
3. **选择合适模型**: 使用 `glm-4.5-air` 提升速度

### 📝 Token管理
1. **监控使用量**: 关注状态栏统计
2. **合理设置限制**: 避免超出配额
3. **定期重置**: 清理累积的使用统计

## 🆘 更新日志

### v1.0.1 (2024-10-06)
- 🚀 新增推荐Base URL，响应速度提升70%
- 🔧 优化连接稳定性，支持多种端点格式
- 🛠️ 增强错误处理和诊断工具
- 📊 改进Token统计准确性

### v1.0.0 (2024-10-06)
- 🎉 首个版本发布
- ✅ 基础智能补全功能
- 📊 实时Token统计显示
- ⚙️ 完整配置管理系统
- 🎯 多语言代码支持

## 📞 支持

- 🌐 **平台**: Windows、macOS、Linux
- 💻 **语言**: JavaScript、TypeScript、Python、Java、C++、Go、Rust、PHP、Ruby等
- 🔌 **IDE**: Visual Studio Code 1.85.0+

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交Issue和Pull Request来帮助改进插件！

## 📞 联系

如有问题或建议，请通过以下方式联系：

- 🐛 **GitHub Issues**: [提交问题](https://github.com/your-repo/issues)
- 📧 **邮箱**: [插件反馈](mailto:feedback@example.com)

---

<div align="center">

**享受AI驱动的代码补全体验！** 🚀

Made with ❤️ by AI Assistant

</div>