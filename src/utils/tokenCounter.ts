import * as vscode from 'vscode';

export interface TokenStats {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
    lastReset: Date;
}

export class TokenCounter {
    private context: vscode.ExtensionContext;
    private stats: TokenStats = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestCount: 0,
        lastReset: new Date()
    };

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadStats();
    }

    /**
     * 加载统计数据
     */
    private loadStats(): void {
        const stored = this.context.globalState.get<TokenStats>('aiCompletion.tokenStats');

        if (stored) {
            this.stats = stored;
            // 确保日期对象正确解析
            this.stats.lastReset = new Date(stored.lastReset);
        } else {
            this.resetStats();
        }
    }

    /**
     * 保存统计数据
     */
    private saveStats(): void {
        this.context.globalState.update('aiCompletion.tokenStats', this.stats);
    }

    /**
     * 添加Token使用量
     */
    public addTokens(inputTokens: number, outputTokens: number): void {
        this.stats.inputTokens += inputTokens;
        this.stats.outputTokens += outputTokens;
        this.stats.totalTokens += (inputTokens + outputTokens);
        this.stats.requestCount += 1;
        this.saveStats();
    }

    /**
     * 获取统计数据
     */
    public getStats(): TokenStats {
        return { ...this.stats };
    }

    /**
     * 重置统计数据
     */
    public resetStats(): void {
        this.stats = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            requestCount: 0,
            lastReset: new Date()
        };
        this.saveStats();
    }

    /**
     * 获取格式化的统计字符串
     */
    public getFormattedStats(): string {
        const { inputTokens, outputTokens, totalTokens, requestCount } = this.stats;

        return `请求: ${requestCount} | 输入: ${this.formatTokens(inputTokens)} | 输出: ${this.formatTokens(outputTokens)} | 总计: ${this.formatTokens(totalTokens)}`;
    }

    /**
     * 格式化Token数量
     */
    private formatTokens(tokens: number): string {
        if (tokens >= 1000000) {
            return `${(tokens / 1000000).toFixed(1)}M`;
        } else if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        } else {
            return tokens.toString();
        }
    }

    /**
     * 估算文本的Token数量（简单估算）
     */
    public estimateTokens(text: string): number {
        if (!text) return 0;

        // 简单的Token估算：大约4个字符 = 1个Token
        // 这是一个粗略估算，实际Token数量取决于模型的具体分词方式
        return Math.ceil(text.length / 4);
    }

    /**
     * 获取使用量统计信息
     */
    public getUsageInfo(): {
        totalCost: number;
        averageTokensPerRequest: number;
        daysSinceReset: number;
    } {
        const { totalTokens, requestCount, lastReset } = this.stats;

        // 简单的费用估算（根据实际定价模型调整）
        // 这里假设每1000个Token花费$0.002
        const costPer1000Tokens = 0.002;
        const totalCost = (totalTokens / 1000) * costPer1000Tokens;

        const averageTokensPerRequest = requestCount > 0 ? Math.round(totalTokens / requestCount) : 0;

        const daysSinceReset = Math.floor((Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

        return {
            totalCost: parseFloat(totalCost.toFixed(4)),
            averageTokensPerRequest,
            daysSinceReset
        };
    }
}