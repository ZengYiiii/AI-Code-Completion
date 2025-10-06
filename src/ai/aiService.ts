import * as vscode from 'vscode';
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';

export interface CompletionRequest {
    prompt: string;
    language?: string;
    context?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CompletionResponse {
    text: string;
    inputTokens?: number;
    outputTokens?: number;
    success: boolean;
    error?: string;
}

export interface ModelMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class AIService {
    private baseUrl: string = '';
    private apiKey: string = '';
    private model: string = '';
    private maxTokens: number = 1024;
    private temperature: number = 0.3;

    constructor() {
        this.loadConfig();

        // 监听配置变化
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('aiCompletion')) {
                this.loadConfig();
            }
        });
    }

    private loadConfig(): void {
        const config = vscode.workspace.getConfiguration('aiCompletion');
        this.baseUrl = config.get('baseUrl', 'https://open.bigmodel.cn/api/anthropic');
        this.apiKey = config.get('apiKey', '');
        this.model = config.get('model', 'glm-4.6');
        this.maxTokens = config.get('maxTokens', 1024);
        this.temperature = config.get('temperature', 0.3);
    }

    /**
     * 获取代码补全建议
     */
    public async getCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        const startTime = Date.now();

        try {
            if (!this.apiKey) {
                throw new Error('API密钥未配置');
            }

            // 构建请求数据
            const requestData = this.buildRequestData(request);

            // 根据Base URL确定端点
            let apiUrl;
            if (this.baseUrl.includes('/coding/paas/v4')) {
                // 新的coding端点使用 /chat/completions
                apiUrl = `${this.baseUrl}/chat/completions`;
            } else {
                // 旧的anthropic端点使用 /v1/messages
                apiUrl = `${this.baseUrl}/v1/messages`;
            }

            // 构建请求配置
            const requestConfig: AxiosRequestConfig = {
                method: 'POST',
                url: apiUrl,
                data: requestData,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'VSCode-AI-Completion/1.0.0'
                },
                timeout: 15000 // 15秒超时
            };

            // 调试信息
            console.log('AI服务请求:', {
                url: requestConfig.url,
                model: requestData.model,
                messagesCount: requestData.messages?.length || 0,
                maxTokens: requestData.max_tokens,
                temperature: requestData.temperature
            });

            const response: AxiosResponse = await axios(requestConfig);

            // 计算请求耗时
            const duration = Date.now() - startTime;
            console.log('AI服务响应:', {
                status: response.status,
                duration: `${duration}ms`,
                hasData: !!response.data
            });

            return this.parseResponse(response);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error('AI服务错误:', {
                error: error.message,
                duration: `${duration}ms`,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status
            });

            let errorMessage = '未知错误';

            if (error.response) {
                // API返回了错误响应
                const status = error.response.status;
                const data = error.response.data;

                switch (status) {
                    case 401:
                        errorMessage = 'API密钥无效或已过期，请检查配置';
                        break;
                    case 403:
                        errorMessage = 'API访问被拒绝，请检查权限';
                        break;
                    case 429:
                        errorMessage = 'API调用频率过高，请稍后重试';
                        break;
                    case 500:
                        errorMessage = 'API服务器内部错误，请稍后重试';
                        break;
                    default:
                        errorMessage = `API错误 (${status}): ${data?.error?.message || data?.message || error.response.statusText}`;
                }
            } else if (error.request) {
                // 网络请求失败
                if (error.code === 'ECONNABORTED') {
                    errorMessage = '请求超时，请检查网络连接或增加超时时间';
                } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                    errorMessage = '无法连接到API服务器，请检查网络和URL配置';
                } else {
                    errorMessage = `网络连接错误: ${error.message}`;
                }
            } else {
                // 其他错误
                errorMessage = error.message || '请求配置错误';
            }

            return {
                text: '',
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * 构建请求数据
     */
    private buildRequestData(request: CompletionRequest): any {
        const messages = this.buildMessages(request);

        // 智谱AI使用Messages API格式
        return {
            model: this.model,
            messages: messages,
            max_tokens: request.maxTokens || this.maxTokens,
            temperature: request.temperature || this.temperature,
            stream: false
        };
    }

    /**
     * 构建请求消息
     */
    private buildMessages(request: CompletionRequest): ModelMessage[] {
        const systemPrompt = this.buildSystemPrompt(request.language);
        const userPrompt = this.buildUserPrompt(request);

        // 智谱AI支持system角色，使用标准的消息格式
        const messages: ModelMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        // 如果有上下文，添加到用户消息中
        if (request.context && request.context.trim()) {
            messages[1].content = `上下文信息:\n${request.context}\n\n${userPrompt}`;
        }

        return messages;
    }

    /**
     * 构建系统提示词
     */
    private buildSystemPrompt(language?: string): string {
        const languageContext = language ? ` in ${language}` : '';

        return `你是一个专业的代码助手${languageContext}。请提供准确、简洁的代码补全建议。

规则:
1. 只返回代码部分，不要包含任何解释文字
2. 确保代码语法正确且符合最佳实践
3. 保持与现有代码风格一致
4. 优先考虑性能和可读性
5. 如果无法确定合适的补全内容，返回空字符串
6. 补全内容应该简洁且实用

请直接提供代码补全内容，不要包含markdown格式标记。`;
    }

    /**
     * 构建用户提示词
     */
    private buildUserPrompt(request: CompletionRequest): string {
        let prompt = '请补全以下代码:\n\n';

        if (request.context) {
            prompt += '上下文:\n```\n' + request.context + '\n```\n\n';
        }

        prompt += '当前代码:\n```\n' + request.prompt + '\n```\n\n';
        prompt += '请提供合适的补全内容:';

        return prompt;
    }

    /**
     * 解析API响应
     */
    private parseResponse(response: AxiosResponse): CompletionResponse {
        try {
            const data = response.data;

            console.log('解析API响应:', {
                hasData: !!data,
                dataKeys: data ? Object.keys(data) : [],
                responseType: response.headers['content-type']
            });

            // 检查响应格式
            if (!data || typeof data !== 'object') {
                throw new Error('响应格式错误: 无效的数据格式');
            }

            // 检查是否有错误
            if (data.error) {
                throw new Error(`API错误: ${data.error.message || data.error}`);
            }

            let content = '';
            let inputTokens = 0;
            let outputTokens = 0;

            // OpenAI格式解析 (新的coding端点)
            if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
                const choice = data.choices[0];
                content = choice.message?.content || choice.text || '';

                // 提取usage信息
                if (data.usage) {
                    inputTokens = data.usage.prompt_tokens || data.usage.input_tokens || 0;
                    outputTokens = data.usage.completion_tokens || data.usage.output_tokens || 0;
                }
            }
            // 智谱AI/Anthropic格式解析 (旧的anthropic端点)
            else if (data.content && Array.isArray(data.content) && data.content.length > 0) {
                const textContent = data.content.find((item: any) => item.type === 'text');
                content = textContent?.text || '';

                if (data.usage) {
                    inputTokens = data.usage.input_tokens || 0;
                    outputTokens = data.usage.output_tokens || 0;
                }
            }
            // 其他格式尝试
            else if (data.response) {
                content = data.response;
                if (data.usage) {
                    inputTokens = data.usage.input_tokens || 0;
                    outputTokens = data.usage.output_tokens || 0;
                }
            }
            else if (data.text) {
                content = data.text;
                if (data.usage) {
                    inputTokens = data.usage.input_tokens || 0;
                    outputTokens = data.usage.output_tokens || 0;
                }
            }
            else {
                console.warn('未知的响应格式:', data);
                throw new Error('无法解析API响应格式');
            }

            // 验证内容
            if (!content || typeof content !== 'string') {
                console.warn('响应内容为空或格式不正确:', { content, data });
                content = '';
            }

            console.log('解析成功:', {
                contentLength: content.length,
                inputTokens,
                outputTokens,
                hasContent: content.length > 0
            });

            return {
                text: content.trim(),
                inputTokens,
                outputTokens,
                success: true
            };

        } catch (error: any) {
            console.error('解析响应失败:', {
                error: error.message,
                response: response.data,
                status: response.status
            });
            return {
                text: '',
                success: false,
                error: `响应解析失败: ${error.message}`
            };
        }
    }

    /**
     * 检查服务是否可用
     */
    public async isHealthy(): Promise<boolean> {
        try {
            const testRequest: CompletionRequest = {
                prompt: 'test',
                maxTokens: 1
            };

            const response = await this.getCompletion(testRequest);
            return response.success;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取当前配置
     */
    public getConfig() {
        return {
            baseUrl: this.baseUrl,
            model: this.model,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            hasApiKey: !!this.apiKey
        };
    }
}