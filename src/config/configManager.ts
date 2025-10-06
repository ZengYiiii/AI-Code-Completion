import * as vscode from 'vscode';
import { NotificationManager } from '../utils/notificationManager';

export interface AICompletionConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    enabled: boolean;
    delay: number;
    autoAccept: boolean;
    showInlineHints: boolean;
    cacheEnabled: boolean;
    logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

export class ConfigManager {
    private static instance: ConfigManager;
    private notificationManager: NotificationManager;

    constructor(notificationManager: NotificationManager) {
        this.notificationManager = notificationManager;
    }

    public static getInstance(notificationManager?: NotificationManager): ConfigManager {
        if (!ConfigManager.instance) {
            if (!notificationManager) {
                throw new Error('NotificationManager is required for first initialization');
            }
            ConfigManager.instance = new ConfigManager(notificationManager);
        }
        return ConfigManager.instance;
    }

    /**
     * 获取当前配置
     */
    public getConfig(): AICompletionConfig {
        const config = vscode.workspace.getConfiguration('aiCompletion');
        return {
            apiKey: config.get('apiKey', ''),
            baseUrl: config.get('baseUrl', 'https://open.bigmodel.cn/api/anthropic'),
            model: config.get('model', 'glm-4.6'),
            maxTokens: config.get('maxTokens', 1024),
            temperature: config.get('temperature', 0.3),
            enabled: config.get('enabled', true),
            delay: config.get('delay', 500),
            autoAccept: config.get('autoAccept', false),
            showInlineHints: config.get('showInlineHints', true),
            cacheEnabled: config.get('cacheEnabled', true),
            logLevel: config.get('logLevel', 'info')
        };
    }

    /**
     * 更新配置
     */
    public async updateConfig(key: keyof AICompletionConfig, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiCompletion');
        await config.update(key, value, target || vscode.ConfigurationTarget.Global);

        this.notificationManager.showNotification({
            type: 'info',
            title: '配置更新',
            message: `${key} 已更新为: ${JSON.stringify(value)}`,
            timeout: 2000
        });
    }

    /**
     * 验证配置
     */
    public validateConfig(config: Partial<AICompletionConfig>): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 验证API密钥
        if (config.apiKey !== undefined) {
            if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length < 10) {
                errors.push('API密钥格式不正确，请检查是否输入正确');
            }
        }

        // 验证Base URL
        if (config.baseUrl !== undefined) {
            try {
                new URL(config.baseUrl);
            } catch {
                errors.push('Base URL格式不正确，请输入有效的URL');
            }
        }

        // 验证模型名称
        if (config.model !== undefined) {
            const validModels = ['glm-4.6', 'glm-4.5-air'];
            if (!validModels.includes(config.model)) {
                errors.push(`模型名称无效，支持的模型: ${validModels.join(', ')}`);
            }
        }

        // 验证最大Token数
        if (config.maxTokens !== undefined) {
            if (typeof config.maxTokens !== 'number' || config.maxTokens < 1 || config.maxTokens > 8192) {
                errors.push('最大Token数必须在1-8192之间');
            }
        }

        // 验证温度参数
        if (config.temperature !== undefined) {
            if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
                errors.push('温度参数必须在0-2之间');
            }
        }

        // 验证延迟时间
        if (config.delay !== undefined) {
            if (typeof config.delay !== 'number' || config.delay < 100 || config.delay > 5000) {
                errors.push('延迟时间必须在100-5000ms之间');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 显示配置界面
     */
    public async showConfigUI(): Promise<void> {
        const config = this.getConfig();
        const validation = this.validateConfig(config);

        const items: vscode.QuickPickItem[] = [
            {
                label: '$(key) API密钥',
                description: config.apiKey ? '••••••••••••••••' : '未设置',
                detail: '设置AI模型的API密钥'
            },
            {
                label: '$(server) Base URL',
                description: config.baseUrl,
                detail: 'API服务的基础URL'
            },
            {
                label: '$(robot) 模型',
                description: config.model,
                detail: '选择要使用的AI模型'
            },
            {
                label: '$(symbol-numeric) 最大Token数',
                description: config.maxTokens.toString(),
                detail: '单次请求的最大Token数量'
            },
            {
                label: '$(thermometer) 温度参数',
                description: config.temperature.toString(),
                detail: '控制生成文本的随机性 (0-2)'
            },
            {
                label: '$(clock) 延迟时间',
                description: `${config.delay}ms`,
                detail: '输入延迟时间，避免频繁调用API'
            },
            {
                label: '$(check) 启用状态',
                description: config.enabled ? '已启用' : '已禁用',
                detail: '是否启用AI代码补全功能'
            },
            {
                label: '$(circle-slash) 自动接受',
                description: config.autoAccept ? '已启用' : '已禁用',
                detail: '自动接受第一个补全建议'
            },
            {
                label: '$(eye) 内联提示',
                description: config.showInlineHints ? '已启用' : '已禁用',
                detail: '显示内联补全提示'
            },
            {
                label: '$(database) 缓存',
                description: config.cacheEnabled ? '已启用' : '已禁用',
                detail: '启用补全结果缓存'
            },
            {
                label: '$(output) 日志级别',
                description: config.logLevel,
                detail: '设置日志输出级别'
            }
        ];

        // 添加验证状态
        if (!validation.isValid) {
            items.unshift({
                label: '$(warning) 配置验证失败',
                description: `发现 ${validation.errors.length} 个问题`,
                detail: validation.errors.join('; '),
                picked: true
            });
        }

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要修改的配置项',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selection) {
            return;
        }

        await this.handleConfigSelection(selection.label, config);
    }

    /**
     * 处理配置选择
     */
    private async handleConfigSelection(label: string, currentConfig: AICompletionConfig): Promise<void> {
        const configMapping: Record<string, keyof AICompletionConfig> = {
            'API密钥': 'apiKey',
            'Base URL': 'baseUrl',
            '模型': 'model',
            '最大Token数': 'maxTokens',
            '温度参数': 'temperature',
            '延迟时间': 'delay',
            '启用状态': 'enabled',
            '自动接受': 'autoAccept',
            '内联提示': 'showInlineHints',
            '缓存': 'cacheEnabled',
            '日志级别': 'logLevel'
        };

        const configKey = configMapping[label];

        switch (configKey) {
            case 'apiKey':
                await this.updateApiKey();
                break;

            case 'baseUrl':
                await this.updateBaseUrl(currentConfig.baseUrl);
                break;

            case 'model':
                await this.updateModel(currentConfig.model);
                break;

            case 'maxTokens':
                await this.updateMaxTokens(currentConfig.maxTokens);
                break;

            case 'temperature':
                await this.updateTemperature(currentConfig.temperature);
                break;

            case 'delay':
                await this.updateDelay(currentConfig.delay);
                break;

            case 'enabled':
                await this.updateConfig('enabled', !currentConfig.enabled);
                break;

            case 'autoAccept':
                await this.updateConfig('autoAccept', !currentConfig.autoAccept);
                break;

            case 'showInlineHints':
                await this.updateConfig('showInlineHints', !currentConfig.showInlineHints);
                break;

            case 'cacheEnabled':
                await this.updateConfig('cacheEnabled', !currentConfig.cacheEnabled);
                break;

            case 'logLevel':
                await this.updateLogLevel(currentConfig.logLevel);
                break;

            default:
                if (label.includes('配置验证失败')) {
                    await this.showValidationErrors();
                }
                break;
        }
    }

    /**
     * 更新API密钥
     */
    private async updateApiKey(): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: '请输入API密钥',
            password: true,
            placeHolder: '输入您的API密钥...',
            validateInput: (value) => {
                if (!value || value.trim().length < 10) {
                    return 'API密钥长度不正确，请检查';
                }
                return null;
            }
        });

        if (apiKey) {
            await this.updateConfig('apiKey', apiKey.trim());
        }
    }

    /**
     * 更新Base URL
     */
    private async updateBaseUrl(currentUrl: string): Promise<void> {
        const baseUrl = await vscode.window.showInputBox({
            prompt: '请输入Base URL',
            value: currentUrl,
            placeHolder: 'https://api.example.com',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return '请输入有效的URL';
                }
            }
        });

        if (baseUrl) {
            await this.updateConfig('baseUrl', baseUrl.trim());
        }
    }

    /**
     * 更新模型
     */
    private async updateModel(currentModel: string): Promise<void> {
        const models = ['glm-4.6', 'glm-4.5-air'];
        const modelOptions: vscode.QuickPickItem[] = models.map(model => ({
        label: model,
        description: model === currentModel ? '当前模型' : undefined
    }));

    const selectedModel = await vscode.window.showQuickPick(modelOptions, {
            placeHolder: '选择AI模型'
        });

        if (selectedModel) {
            await this.updateConfig('model', selectedModel.label);
        }
    }

    /**
     * 更新最大Token数
     */
    private async updateMaxTokens(currentValue: number): Promise<void> {
        const value = await vscode.window.showInputBox({
            prompt: '请输入最大Token数 (1-8192)',
            value: currentValue.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 8192) {
                    return '请输入1-8192之间的数字';
                }
                return null;
            }
        });

        if (value) {
            await this.updateConfig('maxTokens', parseInt(value));
        }
    }

    /**
     * 更新温度参数
     */
    private async updateTemperature(currentValue: number): Promise<void> {
        const value = await vscode.window.showInputBox({
            prompt: '请输入温度参数 (0-2)',
            value: currentValue.toString(),
            validateInput: (value) => {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0 || num > 2) {
                    return '请输入0-2之间的数字';
                }
                return null;
            }
        });

        if (value) {
            await this.updateConfig('temperature', parseFloat(value));
        }
    }

    /**
     * 更新延迟时间
     */
    private async updateDelay(currentValue: number): Promise<void> {
        const value = await vscode.window.showInputBox({
            prompt: '请输入延迟时间 (100-5000ms)',
            value: currentValue.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 100 || num > 5000) {
                    return '请输入100-5000之间的数字';
                }
                return null;
            }
        });

        if (value) {
            await this.updateConfig('delay', parseInt(value));
        }
    }

    /**
     * 更新日志级别
     */
    private async updateLogLevel(currentLevel: string): Promise<void> {
        const levels = ['none', 'error', 'warn', 'info', 'debug'];
        const levelOptions: vscode.QuickPickItem[] = levels.map(level => ({
        label: level,
        description: level === currentLevel ? '当前级别' : undefined
    }));

    const selectedLevel = await vscode.window.showQuickPick(levelOptions, {
            placeHolder: '选择日志级别'
        });

        if (selectedLevel) {
            await this.updateConfig('logLevel', selectedLevel.label);
        }
    }

    /**
     * 显示验证错误
     */
    private async showValidationErrors(): Promise<void> {
        const config = this.getConfig();
        const validation = this.validateConfig(config);

        if (!validation.isValid) {
            await this.notificationManager.showNotification({
                type: 'error',
                title: '配置验证失败',
                message: validation.errors.join('\n'),
                actions: [
                    { title: '修复配置', isCloseAffordance: false },
                    { title: '关闭', isCloseAffordance: true }
                ]
            }).then(selection => {
                if (selection && selection.title === '修复配置') {
                    this.showConfigUI();
                }
            });
        }
    }

    /**
     * 重置配置
     */
    public async resetConfig(): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            '确定要重置所有配置为默认值吗？此操作不可撤销。',
            { modal: true },
            '确定',
            '取消'
        );

        if (confirmation === '确定') {
            const defaultConfig = {
                apiKey: '',
                baseUrl: 'https://open.bigmodel.cn/api/anthropic',
                model: 'glm-4.6',
                maxTokens: 1024,
                temperature: 0.3,
                enabled: true,
                delay: 500,
                autoAccept: false,
                showInlineHints: true,
                cacheEnabled: true,
                logLevel: 'info' as const
            };

            for (const [key, value] of Object.entries(defaultConfig)) {
                await this.updateConfig(key as keyof AICompletionConfig, value);
            }

            this.notificationManager.showNotification({
                type: 'info',
                title: '配置重置',
                message: '所有配置已重置为默认值',
                timeout: 3000
            });
        }
    }

    /**
     * 导出配置
     */
    public exportConfig(): string {
        const config = this.getConfig();
        // 不导出API密钥
        const { apiKey, ...exportableConfig } = config;
        return JSON.stringify(exportableConfig, null, 2);
    }

    /**
     * 导入配置
     */
    public async importConfig(configJson: string): Promise<boolean> {
        try {
            const config = JSON.parse(configJson) as Partial<AICompletionConfig>;
            const validation = this.validateConfig(config);

            if (!validation.isValid) {
                this.notificationManager.showNotification({
                    type: 'error',
                    title: '导入失败',
                    message: validation.errors.join('\n')
                });
                return false;
            }

            for (const [key, value] of Object.entries(config)) {
                if (key !== 'apiKey') { // 不导入API密钥
                    await this.updateConfig(key as keyof AICompletionConfig, value, vscode.ConfigurationTarget.Global);
                }
            }

            this.notificationManager.showNotification({
                type: 'info',
                title: '导入成功',
                message: '配置已成功导入',
                timeout: 2000
            });

            return true;
        } catch (error) {
            this.notificationManager.showNotification({
                type: 'error',
                title: '导入失败',
                message: '配置文件格式不正确'
            });
            return false;
        }
    }
}