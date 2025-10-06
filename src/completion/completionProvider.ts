import * as vscode from 'vscode';
import { AIService, CompletionRequest, CompletionResponse } from '../ai/aiService';
import { TokenCounter } from '../utils/tokenCounter';
import { ContextAnalyzer } from '../utils/contextAnalyzer';
import { NotificationManager } from '../utils/notificationManager';

interface CompletionCache {
    text: string;
    timestamp: number;
    context: string;
}

export class AICompletionProvider implements vscode.CompletionItemProvider {
    private aiService: AIService;
    private tokenCounter: TokenCounter;
    private contextAnalyzer: ContextAnalyzer;
    private notificationManager: NotificationManager;
    private cache: Map<string, CompletionCache> = new Map();
    private debounceMap: Map<string, NodeJS.Timeout> = new Map();
    private readonly CACHE_DURATION = 30000; // 30秒缓存
    private readonly DEBOUNCE_DELAY = 500; // 500ms防抖

    constructor(
        aiService: AIService,
        tokenCounter: TokenCounter,
        contextAnalyzer: ContextAnalyzer,
        notificationManager: NotificationManager
    ) {
        this.aiService = aiService;
        this.tokenCounter = tokenCounter;
        this.contextAnalyzer = contextAnalyzer;
        this.notificationManager = notificationManager;
    }

    /**
     * 提供代码补全项
     */
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {

        // 检查是否启用
        const config = vscode.workspace.getConfiguration('aiCompletion');
        if (!config.get('enabled')) {
            return [];
        }

        // 检查是否被取消
        if (token.isCancellationRequested) {
            return [];
        }

        try {
            // 获取补全建议
            const suggestions = await this.getCompletionSuggestions(document, position, token);

            if (suggestions.length === 0) {
                return [];
            }

            // 转换为VS Code补全项
            const completionItems = suggestions.map((suggestion, index) =>
                this.createCompletionItem(suggestion, document, position, index)
            );

            return new vscode.CompletionList(completionItems, true);

        } catch (error) {
            console.error('获取补全建议失败:', error);
            return [];
        }
    }

    /**
     * 获取补全建议
     */
    private async getCompletionSuggestions(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<string[]> {

        // 构建缓存键
        const cacheKey = this.buildCacheKey(document, position);

        // 检查缓存
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return [cached.text];
        }

        // 检查防抖
        if (this.debounceMap.has(cacheKey)) {
            clearTimeout(this.debounceMap.get(cacheKey)!);
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                try {
                    // 如果被取消，直接返回
                    if (token.isCancellationRequested) {
                        resolve([]);
                        return;
                    }

                    // 构建请求
                    const request = this.buildCompletionRequest(document, position);

                    if (!request.prompt.trim()) {
                        resolve([]);
                        return;
                    }

                    // 调用AI服务
                    const response = await this.aiService.getCompletion(request);

                    if (response.success && response.text.trim()) {
                        // 更新Token统计
                        if (response.inputTokens && response.outputTokens) {
                            this.tokenCounter.addTokens(response.inputTokens, response.outputTokens);
                        }

                        // 缓存结果
                        this.cache.set(cacheKey, {
                            text: response.text,
                            timestamp: Date.now(),
                            context: request.context || ''
                        });

                        // 清理旧缓存
                        this.cleanCache();

                        resolve([response.text]);
                    } else {
                        resolve([]);
                    }

                } catch (error) {
                    console.error('获取AI补全失败:', error);
                    resolve([]);
                } finally {
                    this.debounceMap.delete(cacheKey);
                }
            }, this.DEBOUNCE_DELAY);

            this.debounceMap.set(cacheKey, timeout);
        });
    }

    /**
     * 构建补全请求
     */
    private buildCompletionRequest(
        document: vscode.TextDocument,
        position: vscode.Position
    ): CompletionRequest {

        // 获取当前行文本
        const lineText = document.lineAt(position.line).text;
        const currentLinePrefix = lineText.substring(0, position.character);

        // 获取上下文（前后几行）
        const context = this.getContext(document, position);

        // 获取文件语言
        const language = document.languageId;

        // 构建提示词
        const prompt = this.buildPrompt(currentLinePrefix, context, position);

        return {
            prompt,
            language,
            context: context.fullContext
        };
    }

    /**
     * 获取上下文
     */
    private getContext(document: vscode.TextDocument, position: vscode.Position): {
        before: string[];
        after: string[];
        fullContext: string;
    } {
        const beforeLines: string[] = [];
        const afterLines: string[] = [];
        const contextLines = 10; // 上下文行数

        // 获取前面的行
        for (let i = Math.max(0, position.line - contextLines); i < position.line; i++) {
            beforeLines.push(document.lineAt(i).text);
        }

        // 获取后面的行
        for (let i = position.line + 1; i < Math.min(document.lineCount, position.line + contextLines + 1); i++) {
            afterLines.push(document.lineAt(i).text);
        }

        const fullContext = [
            ...beforeLines,
            document.lineAt(position.line).text,
            ...afterLines
        ].join('\n');

        return {
            before: beforeLines,
            after: afterLines,
            fullContext
        };
    }

    /**
     * 构建提示词
     */
    private buildPrompt(currentLine: string, context: any, position: vscode.Position): string {
        // 获取当前行的缩进
        const indent = currentLine.match(/^\s*/)?.[0] || '';

        // 分析当前行的内容类型
        const lineType = this.analyzeLineType(currentLine);

        // 根据不同类型构建不同的提示
        switch (lineType) {
            case 'function_start':
                return currentLine;
            case 'class_start':
                return currentLine;
            case 'if_statement':
                return currentLine;
            case 'loop_start':
                return currentLine;
            case 'variable_declaration':
                return currentLine;
            case 'import_statement':
                return currentLine;
            case 'comment':
                return currentLine;
            default:
                // 对于一般情况，提供当前行
                return currentLine;
        }
    }

    /**
     * 分析当前行类型
     */
    private analyzeLineType(line: string): string {
        const trimmedLine = line.trim();

        // 函数开始
        if (trimmedLine.match(/^(function|def|func|public|private|protected)\s+\w+\s*\([^)]*\)\s*(?:\{|\:|where)/)) {
            return 'function_start';
        }

        // 类开始
        if (trimmedLine.match(/^(class|struct|interface)\s+\w+/)) {
            return 'class_start';
        }

        // 条件语句
        if (trimmedLine.match(/^(if|else if|elif|when)\s*\(.*\)\s*\{?/)) {
            return 'if_statement';
        }

        // 循环开始
        if (trimmedLine.match(/^(for|while|do)\s*\(.*\)\s*\{?/)) {
            return 'loop_start';
        }

        // 变量声明
        if (trimmedLine.match(/^(const|let|var|private|public|protected)\s+\w+/)) {
            return 'variable_declaration';
        }

        // 导入语句
        if (trimmedLine.match(/^(import|include|require|using)\s+/)) {
            return 'import_statement';
        }

        // 注释
        if (trimmedLine.match(/^\/\*|\/\/|#/)) {
            return 'comment';
        }

        return 'general';
    }

    /**
     * 创建补全项
     */
    private createCompletionItem(
        suggestion: string,
        document: vscode.TextDocument,
        position: vscode.Position,
        index: number
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.Text);

        // 设置插入文本
        item.insertText = this.formatInsertText(suggestion, document, position);

        // 设置排序
        item.sortText = `ai${index.toString().padStart(3, '0')}`;

        // 设置详细信息
        item.documentation = new vscode.MarkdownString(`
### AI 代码补全建议

**建议内容:**
\`\`\`${document.languageId}
${suggestion}
\`\`\`

*此建议由AI模型生成，请仔细检查代码质量和安全性。*
        `);

        // 设置额外信息
        item.detail = 'AI 补全建议';

        return item;
    }

    /**
     * 格式化插入文本
     */
    private formatInsertText(suggestion: string, document: vscode.TextDocument, position: vscode.Position): string {
        // 获取当前行
        const line = document.lineAt(position.line);
        const linePrefix = line.text.substring(0, position.character);

        // 检查是否需要调整缩进
        const currentIndent = linePrefix.match(/^\s*/)?.[0] || '';

        // 如果建议是多行代码，需要调整每行的缩进
        if (suggestion.includes('\n')) {
            const lines = suggestion.split('\n');
            return lines.map((line, index) => {
                if (index === 0) {
                    return line;
                }
                // 为后续行添加当前缩进
                return currentIndent + line;
            }).join('\n');
        }

        return suggestion;
    }

    /**
     * 构建缓存键
     */
    private buildCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
        const lineText = document.lineAt(position.line).text.substring(0, position.character);
        return `${document.uri.fsPath}:${position.line}:${position.character}:${lineText}`;
    }

    /**
     * 清理过期缓存
     */
    private cleanCache(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 清空缓存
     */
    public clearCache(): void {
        this.cache.clear();
        this.debounceMap.forEach(timeout => clearTimeout(timeout));
        this.debounceMap.clear();
    }
}