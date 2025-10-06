import * as vscode from 'vscode';

export interface CodeContext {
    language: string;
    currentLine: string;
    previousLines: string[];
    nextLines: string[];
    functionScope: FunctionScope | null;
    classScope: ClassScope | null;
    importStatements: string[];
    variables: VariableInfo[];
    codeType: CodeType;
    indentation: string;
}

export interface FunctionScope {
    name: string;
    parameters: string[];
    returnType?: string;
    startLine: number;
    endLine?: number;
    isAsync: boolean;
}

export interface ClassScope {
    name: string;
    extends?: string;
    implements?: string[];
    startLine: number;
    endLine?: number;
    methods: string[];
    properties: string[];
}

export interface VariableInfo {
    name: string;
    type?: string;
    value?: string;
    line: number;
    scope: 'local' | 'parameter' | 'global';
}

export type CodeType =
    | 'function_declaration'
    | 'function_call'
    | 'class_declaration'
    | 'variable_declaration'
    | 'import_statement'
    | 'comment'
    | 'string_literal'
    | 'conditional_statement'
    | 'loop_statement'
    | 'return_statement'
    | 'try_catch'
    | 'interface_declaration'
    | 'type_declaration'
    | 'general';

export class ContextAnalyzer {
    private languageConfigs: Map<string, LanguageConfig> = new Map();

    constructor() {
        this.initializeLanguageConfigs();
    }

    /**
     * 分析代码上下文
     */
    public analyzeContext(document: vscode.TextDocument, position: vscode.Position): CodeContext {
        const language = document.languageId;
        const currentLine = document.lineAt(position.line).text;
        const currentLinePrefix = currentLine.substring(0, position.character);

        // 获取上下文行
        const { previousLines, nextLines } = this.getSurroundingLines(document, position);

        // 分析作用域
        const functionScope = this.analyzeFunctionScope(document, position);
        const classScope = this.analyzeClassScope(document, position);

        // 提取导入语句
        const importStatements = this.extractImportStatements(document);

        // 提取变量信息
        const variables = this.extractVariables(document, position);

        // 确定代码类型
        const codeType = this.determineCodeType(currentLinePrefix, language, functionScope, classScope);

        // 获取缩进
        const indentation = this.getIndentation(currentLine);

        return {
            language,
            currentLine: currentLinePrefix,
            previousLines,
            nextLines,
            functionScope,
            classScope,
            importStatements,
            variables,
            codeType,
            indentation
        };
    }

    /**
     * 获取周围行
     */
    private getSurroundingLines(document: vscode.TextDocument, position: vscode.Position): {
        previousLines: string[];
        nextLines: string[];
    } {
        const contextSize = 10;
        const startLine = Math.max(0, position.line - contextSize);
        const endLine = Math.min(document.lineCount - 1, position.line + contextSize);

        const previousLines: string[] = [];
        const nextLines: string[] = [];

        for (let i = startLine; i < position.line; i++) {
            previousLines.push(document.lineAt(i).text);
        }

        for (let i = position.line + 1; i <= endLine; i++) {
            nextLines.push(document.lineAt(i).text);
        }

        return { previousLines, nextLines };
    }

    /**
     * 分析函数作用域
     */
    private analyzeFunctionScope(document: vscode.TextDocument, position: vscode.Position): FunctionScope | null {
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return null;
        }

        // 向上查找函数声明
        for (let line = position.line; line >= 0; line--) {
            const lineText = document.lineAt(line).text;
            const trimmedLine = lineText.trim();

            // 检查是否匹配函数模式
            const functionMatch = config.functionPattern.exec(trimmedLine);
            if (functionMatch) {
                return {
                    name: functionMatch[1] || 'anonymous',
                    parameters: this.extractParameters(functionMatch[2] || ''),
                    returnType: functionMatch[3],
                    startLine: line,
                    isAsync: config.asyncPattern?.test(trimmedLine) || false
                };
            }
        }

        return null;
    }

    /**
     * 分析类作用域
     */
    private analyzeClassScope(document: vscode.TextDocument, position: vscode.Position): ClassScope | null {
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return null;
        }

        // 向上查找类声明
        for (let line = position.line; line >= 0; line--) {
            const lineText = document.lineAt(line).text;
            const trimmedLine = lineText.trim();

            // 检查是否匹配类模式
            const classMatch = config.classPattern.exec(trimmedLine);
            if (classMatch) {
                return {
                    name: classMatch[1],
                    extends: classMatch[2],
                    startLine: line,
                    methods: this.extractMethods(document, line, position.line),
                    properties: this.extractProperties(document, line, position.line)
                };
            }
        }

        return null;
    }

    /**
     * 提取参数
     */
    private extractParameters(paramStr: string): string[] {
        const params = paramStr.split(',').map(p => p.trim()).filter(p => p);
        return params.map(param => {
            // 移除默认值和类型注解
            const cleanParam = param.split('=')[0].split(':')[0].trim();
            return cleanParam;
        });
    }

    /**
     * 提取方法
     */
    private extractMethods(document: vscode.TextDocument, startLine: number, endLine: number): string[] {
        const methods: string[] = [];
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return methods;
        }

        for (let line = startLine + 1; line < endLine; line++) {
            const lineText = document.lineAt(line).text;
            const methodMatch = config.functionPattern.exec(lineText.trim());
            if (methodMatch) {
                methods.push(methodMatch[1] || 'anonymous');
            }
        }

        return methods;
    }

    /**
     * 提取属性
     */
    private extractProperties(document: vscode.TextDocument, startLine: number, endLine: number): string[] {
        const properties: string[] = [];
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return properties;
        }

        for (let line = startLine + 1; line < endLine; line++) {
            const lineText = document.lineAt(line).text;
            const propertyMatch = config.propertyPattern?.exec(lineText.trim());
            if (propertyMatch) {
                properties.push(propertyMatch[1]);
            }
        }

        return properties;
    }

    /**
     * 提取导入语句
     */
    private extractImportStatements(document: vscode.TextDocument): string[] {
        const imports: string[] = [];
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return imports;
        }

        for (let line = 0; line < document.lineCount; line++) {
            const lineText = document.lineAt(line).text;
            const importMatch = config.importPattern.exec(lineText.trim());
            if (importMatch) {
                imports.push(lineText.trim());
            }
        }

        return imports;
    }

    /**
     * 提取变量
     */
    private extractVariables(document: vscode.TextDocument, position: vscode.Position): VariableInfo[] {
        const variables: VariableInfo[] = [];
        const language = document.languageId;
        const config = this.languageConfigs.get(language);

        if (!config) {
            return variables;
        }

        // 在当前位置向上查找变量声明
        for (let line = position.line; line >= 0; line--) {
            const lineText = document.lineAt(line).text;
            const variableMatch = config.variablePattern.exec(lineText.trim());

            if (variableMatch) {
                variables.push({
                    name: variableMatch[1],
                    type: variableMatch[2],
                    value: variableMatch[3],
                    line: line,
                    scope: line === position.line ? 'local' : 'global'
                });
            }
        }

        return variables;
    }

    /**
     * 确定代码类型
     */
    private determineCodeType(
        line: string,
        language: string,
        functionScope: FunctionScope | null,
        classScope: ClassScope | null
    ): CodeType {
        const trimmedLine = line.trim();
        const config = this.languageConfigs.get(language);

        if (!config) {
            return 'general';
        }

        // 检查各种模式
        if (config.functionPattern.test(trimmedLine)) {
            return 'function_declaration';
        }

        if (config.classPattern.test(trimmedLine)) {
            return 'class_declaration';
        }

        if (config.importPattern.test(trimmedLine)) {
            return 'import_statement';
        }

        if (config.variablePattern.test(trimmedLine)) {
            return 'variable_declaration';
        }

        if (config.commentPattern.test(trimmedLine)) {
            return 'comment';
        }

        if (config.stringPattern.test(trimmedLine)) {
            return 'string_literal';
        }

        if (config.conditionalPattern.test(trimmedLine)) {
            return 'conditional_statement';
        }

        if (config.loopPattern.test(trimmedLine)) {
            return 'loop_statement';
        }

        if (config.returnPattern.test(trimmedLine)) {
            return 'return_statement';
        }

        if (config.tryCatchPattern.test(trimmedLine)) {
            return 'try_catch';
        }

        // 检查是否是函数调用
        if (trimmedLine.includes('(') && trimmedLine.includes(')')) {
            return 'function_call';
        }

        return 'general';
    }

    /**
     * 获取缩进
     */
    private getIndentation(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    /**
     * 初始化语言配置
     */
    private initializeLanguageConfigs(): void {
        // JavaScript/TypeScript 配置
        this.languageConfigs.set('javascript', {
            functionPattern: /^(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function)/,
            classPattern: /^class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{/,
            importPattern: /^(?:import\s+.*from\s+['"][^'"]+['"]|const\s+.*=\s*require\(['"][^'"]+['"]\))/,
            variablePattern: /^(?:const|let|var)\s+(\w+)(?::\s*(\w+))?(?:\s*=\s*(.+))?/,
            commentPattern: /^\/\//,
            stringPattern: /^['"]/,
            conditionalPattern: /^(?:if|else\s+if|switch)\s*\(/,
            loopPattern: /^(?:for|while|do)\s*\(/,
            returnPattern: /^return\b/,
            tryCatchPattern: /^(?:try|catch|finally)\b/,
            propertyPattern: /^(?:this\.|const\s+(\w+)\s*=)/,
            asyncPattern: /\basync\b/
        });

        // Python 配置
        this.languageConfigs.set('python', {
            functionPattern: /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+))?:/,
            classPattern: /^class\s+(\w+)(?:\s*\(\s*([^)]+)\s*\))?:/,
            importPattern: /^(?:import\s+\w+|from\s+\w+\s+import)/,
            variablePattern: /^(\w+)\s*=\s*(.+)/,
            commentPattern: /^#/,
            stringPattern: /^['"]/,
            conditionalPattern: /^(?:if|elif|else)\s+/,
            loopPattern: /^(?:for|while)\s+/,
            returnPattern: /^return\b/,
            tryCatchPattern: /^(?:try|except|finally)\b/,
            asyncPattern: /\basync\b/
        });

        // Java 配置
        this.languageConfigs.set('java', {
            functionPattern: /^(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)*(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[^{]+)?\s*[{;]/,
            classPattern: /^(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{/,
            importPattern: /^import\s+([^;]+);/,
            variablePattern: /^(?:final\s+)?(?:\w+\s+)+(\w+)(?:\s*=\s*(.+))?/,
            commentPattern: /^(?:\/\/|\/\*)/,
            stringPattern: /^"/,
            conditionalPattern: /^(?:if|else\s+if|switch)\s*\(/,
            loopPattern: /^(?:for|while)\s*\(/,
            returnPattern: /^return\b/,
            tryCatchPattern: /^(?:try|catch|finally)\b/
        });

        // C++ 配置
        this.languageConfigs.set('cpp', {
            functionPattern: /^(?:\w+\s+)*(\w+)\s*\(([^)]*)\)(?:\s*const)?\s*(?:\{|;)/,
            classPattern: /^class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?\s*{/,
            importPattern: /^#include\s*[<"][^>"]+[>"]/,
            variablePattern: /^(?:\w+\s+)+(\w+)(?:\s*=\s*(.+))?/,
            commentPattern: /^(?:\/\/|\/\*)/,
            stringPattern: /^"/,
            conditionalPattern: /^(?:if|else\s+if|switch)\s*\(/,
            loopPattern: /^(?:for|while)\s*\(/,
            returnPattern: /^return\b/,
            tryCatchPattern: /^(?:try|catch)\b/
        });
    }
}

interface LanguageConfig {
    functionPattern: RegExp;
    classPattern: RegExp;
    importPattern: RegExp;
    variablePattern: RegExp;
    commentPattern: RegExp;
    stringPattern: RegExp;
    conditionalPattern: RegExp;
    loopPattern: RegExp;
    returnPattern: RegExp;
    tryCatchPattern: RegExp;
    propertyPattern?: RegExp;
    asyncPattern?: RegExp;
}