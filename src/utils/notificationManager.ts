import * as vscode from 'vscode';

export interface NotificationOptions {
    type: 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    actions?: vscode.MessageItem[];
    timeout?: number;
    showInStatusBar?: boolean;
}

export class NotificationManager {
    private static instance: NotificationManager;
    private outputChannel: vscode.OutputChannel;
    private statusBarNotification: vscode.StatusBarItem | null = null;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AI Code Completion');
    }

    public static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    /**
     * 显示通知
     */
    public async showNotification(options: NotificationOptions): Promise<vscode.MessageItem | undefined> {
        const { type, title, message, actions, timeout, showInStatusBar } = options;

        // 记录到输出面板
        this.logToOutput(type, title, message);

        // 显示在状态栏（可选）
        if (showInStatusBar) {
            this.showStatusBarNotification(message, type, timeout);
        }

        // 构建完整消息
        const fullMessage = title ? `${title}: ${message}` : message;

        // 根据类型显示不同的通知
        switch (type) {
            case 'error':
                return await vscode.window.showErrorMessage(fullMessage, ...actions || []);
            case 'warning':
                return await vscode.window.showWarningMessage(fullMessage, ...actions || []);
            default:
                return await vscode.window.showInformationMessage(fullMessage, ...actions || []);
        }
    }

    /**
     * 显示进度通知
     */
    public async showProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: false
            },
            task
        );
    }

    /**
     * 显示状态栏通知
     */
    private showStatusBarNotification(message: string, type: 'info' | 'warning' | 'error', timeout: number = 3000): void {
        if (!this.statusBarNotification) {
            this.statusBarNotification = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                200
            );
        }

        const icon = type === 'error' ? '$(error)' : type === 'warning' ? '$(warning)' : '$(info)';
        this.statusBarNotification.text = `${icon} ${message}`;
        this.statusBarNotification.tooltip = message;
        this.statusBarNotification.show();

        // 自动隐藏
        setTimeout(() => {
            if (this.statusBarNotification) {
                this.statusBarNotification.hide();
            }
        }, timeout);
    }

    /**
     * 记录到输出面板
     */
    private logToOutput(type: 'info' | 'warning' | 'error', title: string | undefined, message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const typeLabel = type.toUpperCase();
        const titleText = title ? `[${title}] ` : '';

        const logMessage = `[${timestamp}] ${typeLabel} ${titleText}${message}\n`;
        this.outputChannel.append(logMessage);
    }

    /**
     * 记录API调用日志
     */
    public logApiCall(endpoint: string, requestData: any, responseData: any, duration: number): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] API Call: ${endpoint}`);
        this.outputChannel.appendLine(`Request: ${JSON.stringify(requestData, null, 2)}`);
        this.outputChannel.appendLine(`Response: ${JSON.stringify(responseData, null, 2)}`);
        this.outputChannel.appendLine(`Duration: ${duration}ms`);
        this.outputChannel.appendLine('---');
    }

    /**
     * 记录错误日志
     */
    public logError(error: Error, context?: string): void {
        const timestamp = new Date().toLocaleTimeString();
        const contextText = context ? `[${context}] ` : '';

        this.outputChannel.appendLine(`[${timestamp}] ERROR ${contextText}${error.message}`);
        this.outputChannel.appendLine(`Stack: ${error.stack}`);
        this.outputChannel.appendLine('---');
    }

    /**
     * 记录性能指标
     */
    public logPerformance(operation: string, duration: number, details?: any): void {
        const timestamp = new Date().toLocaleTimeString();
        const detailsText = details ? ` | ${JSON.stringify(details)}` : '';

        this.outputChannel.appendLine(`[${timestamp}] PERFORMANCE ${operation}: ${duration}ms${detailsText}`);
    }

    /**
     * 显示输出面板
     */
    public showOutputPanel(): void {
        this.outputChannel.show();
    }

    /**
     * 清理输出面板
     */
    public clearOutputPanel(): void {
        this.outputChannel.clear();
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        if (this.statusBarNotification) {
            this.statusBarNotification.dispose();
        }
        this.outputChannel.dispose();
    }
}