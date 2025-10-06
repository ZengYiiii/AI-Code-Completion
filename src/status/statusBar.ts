import * as vscode from 'vscode';
import { TokenCounter } from '../utils/tokenCounter';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private tokenCounter: TokenCounter;

    constructor(tokenCounter: TokenCounter) {
        this.tokenCounter = tokenCounter;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100 // 优先级
        );

        this.statusBarItem.command = 'aiCompletion.showStats';
        this.update();
        this.show();

        // 每隔一段时间自动更新状态栏
        setInterval(() => {
            this.update();
        }, 5000); // 每5秒更新一次
    }

    /**
     * 更新状态栏显示
     */
    public update(): void {
        const stats = this.tokenCounter.getStats();
        const usageInfo = this.tokenCounter.getUsageInfo();

        const config = vscode.workspace.getConfiguration('aiCompletion');
        const isEnabled = config.get('enabled', true);

        if (!isEnabled) {
            this.statusBarItem.text = '$(circle-slash) AI补全已禁用';
            this.statusBarItem.tooltip = '点击查看详情，或使用 Ctrl+Alt+A 启用';
            this.statusBarItem.color = '#ff6b6b';
            return;
        }

        const statsText = this.tokenCounter.getFormattedStats();
        const costText = `费用: $${usageInfo.totalCost.toFixed(4)}`;

        this.statusBarItem.text = `$(robot) ${statsText}`;
        this.statusBarItem.tooltip = new vscode.MarkdownString(`
### AI 代码补全统计

**使用统计:**
- ${statsText}

**费用估算:**
- ${costText}
- 平均每请求: ${usageInfo.averageTokensPerRequest} tokens
- 使用天数: ${usageInfo.daysSinceReset} 天

**操作:**
- 点击查看详细统计
- 使用 \`aiCompletion.showStats\` 命令查看详情
- 使用 \`aiCompletion.resetStats\` 重置统计
- 使用 \`aiCompletion.toggle\` 切换启用状态

**配置:**
- 模型: ${config.get('model', 'glm-4.6')}
- 最大Token: ${config.get('maxTokens', 1024)}
- 温度参数: ${config.get('temperature', 0.3)}
        `);
        this.statusBarItem.color = undefined;
    }

    /**
     * 显示状态栏
     */
    public show(): void {
        this.statusBarItem.show();
    }

    /**
     * 隐藏状态栏
     */
    public hide(): void {
        this.statusBarItem.hide();
    }

    /**
     * 销毁状态栏
     */
    public dispose(): void {
        this.statusBarItem.dispose();
    }

    /**
     * 显示临时通知
     */
    public showTemporaryNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        const icon = type === 'error' ? '$(error)' : type === 'warning' ? '$(warning)' : '$(info)';
        const originalText = this.statusBarItem.text;
        const originalTooltip = this.statusBarItem.tooltip;

        this.statusBarItem.text = `${icon} ${message}`;
        this.statusBarItem.tooltip = message;

        // 3秒后恢复原状
        setTimeout(() => {
            this.statusBarItem.text = originalText;
            this.statusBarItem.tooltip = originalTooltip;
        }, 3000);
    }
}