import * as vscode from 'vscode';
import { AICompletionProvider } from './completion/completionProvider';
import { TokenCounter } from './utils/tokenCounter';
import { StatusBarManager } from './status/statusBar';
import { AIService } from './ai/aiService';
import { NotificationManager } from './utils/notificationManager';
import { ContextAnalyzer } from './utils/contextAnalyzer';
import { ConfigManager } from './config/configManager';
// import { ApiTester } from './utils/apiTester';
// import { VSCodeInternalTester } from './debug/vscodeInternalTester';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Completion 插件已激活');

    // 初始化通知管理器
    const notificationManager = NotificationManager.getInstance();

    // 获取配置
    const config = vscode.workspace.getConfiguration('aiCompletion');

    // 检查是否启用
    if (!config.get('enabled')) {
        notificationManager.showNotification({
            type: 'info',
            title: 'AI代码补全',
            message: '插件已禁用，请通过设置启用AI代码补全功能。',
            actions: [{ title: '启用', isCloseAffordance: false }, { title: '稍后', isCloseAffordance: true }]
        }).then(selection => {
            if (selection && selection.title === '启用') {
                vscode.workspace.getConfiguration('aiCompletion').update('enabled', true, true);
            }
        });
        return;
    }

    // 初始化组件
    const aiService = new AIService();
    const tokenCounter = new TokenCounter(context);
    const statusBarManager = new StatusBarManager(tokenCounter);
    const contextAnalyzer = new ContextAnalyzer();
    const configManager = ConfigManager.getInstance(notificationManager);
    // const apiTester = new ApiTester(aiService, notificationManager);
    // const internalTester = new VSCodeInternalTester(aiService, notificationManager);

    // 初始化代码补全提供器
    const completionProvider = new AICompletionProvider(aiService, tokenCounter, contextAnalyzer, notificationManager);

    // 显示欢迎消息
    notificationManager.showNotification({
        type: 'info',
        title: 'AI代码补全',
        message: '插件已激活！使用Tab键触发智能代码补全。',
        timeout: 3000,
        showInStatusBar: true
    });

    // 注册代码补全提供器 - 优化触发字符
    const completionProviderRegistration = vscode.languages.registerCompletionItemProvider(
        { pattern: '**' },
        completionProvider,
        '\t',  // Tab键
        '.',   // 点号 - 对象属性访问
        '(',   // 左括号 - 函数调用
        ' ',   // 空格 - 关键字后空格
        '\n',  // 回车 - 换行后
        ':',   // 冒号 - 类型注解
        '=',   // 等号 - 赋值
        '<'    // 小于号 - 泛型
    );

    // 注册命令
    const toggleCommand = vscode.commands.registerCommand('aiCompletion.toggle', async () => {
        const currentState = vscode.workspace.getConfiguration('aiCompletion').get('enabled');
        await vscode.workspace.getConfiguration('aiCompletion').update('enabled', !currentState, true);

        notificationManager.showNotification({
            type: 'info',
            title: 'AI代码补全',
            message: `AI补全已${!currentState ? '启用' : '禁用'}`,
            showInStatusBar: true
        });

        if (!currentState) {
            statusBarManager.show();
        } else {
            statusBarManager.hide();
        }
    });

    const resetStatsCommand = vscode.commands.registerCommand('aiCompletion.resetStats', async () => {
        tokenCounter.resetStats();
        statusBarManager.update();

        notificationManager.showNotification({
            type: 'info',
            title: '统计重置',
            message: 'Token使用统计已重置',
            showInStatusBar: true
        });
    });

    const showStatsCommand = vscode.commands.registerCommand('aiCompletion.showStats', async () => {
        const stats = tokenCounter.getStats();
        const usageInfo = tokenCounter.getUsageInfo();

        const detailMessage = `
📊 **AI代码补全使用统计**

📝 **请求数量**: ${stats.requestCount}
🔤 **输入Token**: ${stats.inputTokens.toLocaleString()}
💬 **输出Token**: ${stats.outputTokens.toLocaleString()}
📈 **总计Token**: ${stats.totalTokens.toLocaleString()}
💰 **估算费用**: $${usageInfo.totalCost.toFixed(4)}
📊 **平均每请求**: ${usageInfo.averageTokensPerRequest} tokens
📅 **使用天数**: ${usageInfo.daysSinceReset} 天

最后重置: ${stats.lastReset.toLocaleDateString()}
        `.trim();

        const selection = await notificationManager.showNotification({
            type: 'info',
            title: '使用统计',
            message: detailMessage,
            actions: [
                { title: '重置统计', isCloseAffordance: false },
                { title: '查看日志', isCloseAffordance: false },
                { title: '关闭', isCloseAffordance: true }
            ]
        });

        if (selection) {
            switch (selection.title) {
                case '重置统计':
                    tokenCounter.resetStats();
                    statusBarManager.update();
                    break;
                case '查看日志':
                    notificationManager.showOutputPanel();
                    break;
            }
        }
    });

    const testConnectionCommand = vscode.commands.registerCommand('aiCompletion.testConnection', async () => {
        await notificationManager.showProgress('测试AI服务连接...', async (progress) => {
            progress.report({ increment: 0, message: '正在连接...' });

            try {
                const isHealthy = await aiService.isHealthy();

                if (isHealthy) {
                    progress.report({ increment: 100, message: '连接成功！' });
                    notificationManager.showNotification({
                        type: 'info',
                        title: '连接测试',
                        message: 'AI服务连接正常，可以使用代码补全功能。',
                        timeout: 3000
                    });
                } else {
                    throw new Error('连接失败');
                }
            } catch (error) {
                progress.report({ increment: 100, message: '连接失败' });
                notificationManager.showNotification({
                    type: 'error',
                    title: '连接测试失败',
                    message: '无法连接到AI服务，请检查API配置和网络连接。',
                    actions: [
                        { title: '查看设置', isCloseAffordance: false },
                        { title: '查看日志', isCloseAffordance: false }
                    ]
                }).then(selection => {
                    if (selection) {
                        if (selection.title === '查看设置') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'aiCompletion');
                        } else if (selection.title === '查看日志') {
                            notificationManager.showOutputPanel();
                        }
                    }
                });
            }
        });
    });

    const showLogsCommand = vscode.commands.registerCommand('aiCompletion.showLogs', () => {
        notificationManager.showOutputPanel();
    });

  const configureCommand = vscode.commands.registerCommand('aiCompletion.configure', async () => {
        await configManager.showConfigUI();
    });

  const resetConfigCommand = vscode.commands.registerCommand('aiCompletion.resetConfig', async () => {
        await configManager.resetConfig();
    });

  const exportConfigCommand = vscode.commands.registerCommand('aiCompletion.exportConfig', async () => {
        const configJson = configManager.exportConfig();

        const document = await vscode.workspace.openTextDocument({
            content: configJson,
            language: 'json'
        });

        await vscode.window.showTextDocument(document);

        notificationManager.showNotification({
            type: 'info',
            title: '配置导出',
            message: '配置已导出到新标签页，请保存为文件',
            timeout: 3000
        });
    });

  const importConfigCommand = vscode.commands.registerCommand('aiCompletion.importConfig', async () => {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: '导入配置文件',
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri[0]);
                const configJson = document.getText();

                const success = await configManager.importConfig(configJson);

                if (success) {
                    statusBarManager.update();
                }
            } catch (error) {
                notificationManager.showNotification({
                    type: 'error',
                    title: '导入失败',
                    message: '无法读取配置文件，请检查文件格式'
                });
            }
        }
    });

    // 注册所有disposables
    const disposables = [
        completionProviderRegistration,
        toggleCommand,
        resetStatsCommand,
        showStatsCommand,
        testConnectionCommand,
        showLogsCommand,
        configureCommand,
        resetConfigCommand,
        exportConfigCommand,
        importConfigCommand,
        statusBarManager,
        notificationManager
    ];

    disposables.forEach(disposable => context.subscriptions.push(disposable));

    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('aiCompletion')) {
            const newConfig = vscode.workspace.getConfiguration('aiCompletion');

            if (!newConfig.get('enabled')) {
                statusBarManager.hide();
                notificationManager.showNotification({
                    type: 'warning',
                    title: 'AI代码补全已禁用',
                    message: '可以通过命令面板重新启用',
                    timeout: 3000
                });
            } else {
                statusBarManager.show();

                // 测试新配置是否有效
                const configValid = await aiService.isHealthy();
                if (!configValid) {
                    notificationManager.showNotification({
                        type: 'warning',
                        title: '配置可能有误',
                        message: 'AI服务连接失败，请检查API配置',
                        actions: [
                            { title: '检查设置', isCloseAffordance: false }
                        ]
                    }).then(selection => {
                        if (selection && selection.title === '检查设置') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'aiCompletion');
                        }
                    });
                }
            }

            statusBarManager.update();
        }
    });

    // 监听编辑器变化，清理缓存
    vscode.workspace.onDidCloseTextDocument(() => {
        completionProvider.clearCache();
    });

    console.log('AI Code Completion 插件初始化完成');
}

export function deactivate() {
    console.log('AI Code Completion 插件已停用');
}