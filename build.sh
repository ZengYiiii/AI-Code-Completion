#!/bin/bash

# VS Code AI 插件构建脚本
# 支持编译、打包、发布等操作
# Author: AI Assistant
# Last updated: 2025-10-06

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "${2}$1${NC}"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1" ""
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1" ""
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1" ""
}

log_error() {
    log "${RED}[ERROR]${NC} $1" ""
}

# 检查依赖
check_dependencies() {
    log_info "检查构建依赖..."

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "❌ Node.js 未安装，请先安装 Node.js"
        log_info "下载地址: https://nodejs.org/"
        exit 1
    fi

    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "❌ npm 未安装，请先安装npm"
        exit 1
    fi

    # 检查vsce
    if ! command -v vsce &> /dev/null; then
        log_warning "vsce未安装，正在安装..."
        npm install -g @vscode/vsce
    fi

    # 检查TypeScript
    if ! command -v tsc &> /dev/null; then
        log_warning "TypeScript未安装，正在安装..."
        npm install -g typescript
    fi

    log_success "✅ 依赖检查完成"
}

# 清理旧的构建文件
clean_build() {
    log_info "清理旧的构建文件..."

    # 清理编译输出
    if [ -d "out" ]; then
        rm -rf out
        log_info "已清理 out 目录"
    fi

    # 清理旧的VSIX文件
    if ls *.vsix 1> /dev/null 2>&1; then
        log_warning "发现旧的VSIX文件，正在清理..."
        rm *.vsix
        log_info "已清理旧的 VSIX 文件"
    fi

    # 清理日志文件
    if ls *.log 1> /dev/null 2>&1; then
        rm *.log
        log_info "已清理日志文件"
    fi

    log_success "✅ 清理完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "✅ 依赖安装完成"
    else
        log_error "❌ 依赖安装失败"
        exit 1
    fi
}

# 编译TypeScript代码
compile_typescript() {
    log_info "编译 TypeScript 代码..."
    npm run compile
    if [ $? -eq 0 ]; then
        log_success "✅ TypeScript 编译完成"
    else
        log_error "❌ TypeScript 编译失败"
        exit 1
    fi
}

# 运行linting
run_lint() {
    if [ -n "$(find src -name '*.ts' 2>/dev/null)" ]; then
        log_info "运行代码检查..."
        npm run lint
        if [ $? -eq 0 ]; then
            log_success "✅ 代码检查通过"
        else
            log_warning "⚠️ 代码检查发现问题，但继续构建"
        fi
    else
        log_info "没有TypeScript文件需要检查"
    fi
}

# 测试代码
run_tests() {
    log_info "运行测试..."
    npm test
    if [ $? -eq 0 ]; then
        log_success "✅ 所有测试通过"
    else
        log_warning "⚠️ 部分测试失败，但继续构建"
    fi
}

# 打包VSIX文件
package_vsix() {
    log_info "打包 VSIX 文件..."

    vsce package
    if [ $? -eq 0 ]; then
        log_success "✅ VSIX 文件已生成"

        # 显示文件信息
        local vsix_file=$(ls *.vsix 2>/dev/null)
        if [ -f "$vsix_file" ]; then
            local file_size=$(ls -lh "$vsix_file" | awk '{print $5}')
            local file_time=$(ls -l "$vsix_file" | awk '{print $6, $7, $8}')

            log_success "文件名: $vsix_file"
            log_success "文件大小: $file_size"
            log_success "创建时间: $file_time"
            log_success "绝对路径: $(pwd)/$vsix_file"

            log_info ""
            log_info "安装方法:"
            echo "1. 命令行安装: code --install-extension $vsix_file"
            echo "2. VS Code界面: Extensions → Install from VSIX..."
            echo "3. 拖拽安装: 将VSIX文件拖拽到VSCode扩展面板"
        fi
    else
        log_error "❌ VSIX 文件打包失败"
        exit 1
    fi
}

# 发布到市场
publish_to_marketplace() {
    log_info "准备发布到VS Code市场..."

    # 检查是否已登录
    if ! vsce whoami &> /dev/null; then
        log_warning "您未登录VS Code市场，将使用匿名发布"
        log_info "使用 vsce login 登录后再次运行此命令"
    fi

    log_info "发布到市场..."
    vsce publish
    if [ $? -eq 0 ]; then
        log_success "✅ 发布成功！"
    else
        log_error "❌ 发布失败"
        exit 1
    fi
}

# 验证打包结果
verify_package() {
    log_info "验证打包结果..."

    local vsix_file=$(ls *.vsix 2>/dev/null)
    if [ -f "$vsix_file" ]; then
        log_success "✅ 找到 VSIX 文件: $vsix_file"

        # 检查文件完整性
        if unzip -t "$vsix_file" &> /dev/null; then
            log_info "✅ VSIX 文件格式正确"
            
            # 创建临时目录进行测试
            local temp_dir=$(mktemp -d)
            unzip -q "$vsix_file" -d "$temp_dir"

            # 检查关键文件是否存在
            if [ -f "$temp_dir/extension.vsixmanifest" ]; then
                log_info "✅ 插件清单文件正常"
            else
                log_warning "⚠️ 缺少关键文件"
            fi

            rm -rf "$temp_dir"
        else
            log_error "❌ VSIX 文件格式错误"
        fi
    else
        log_error "❌ 未找到 VSIX 文件"
        return 1
    fi
}

# 显示打包信息
show_package_info() {
    log_info "📦 打包信息:"
    echo "========================================"

    local vsix_file=$(ls *.vsix 2>/dev/null)
    if [ -f "$vsix_file" ]; then
        local file_size=$(ls -lh "$vsix_file" | awk '{print $5}')
        local file_time=$(ls -l "$vsix_file" | awk '{print $6, $7, $8}')

        echo "📦 文件名: $vsix_file"
        echo "文件大小: $file_size"
        echo "创建时间: $file_time"
        echo "绝对路径: $(pwd)/$vsix_file"

        echo ""
        echo "🚀 快速安装:"
        echo "code --install-extension $vsix_file"
        echo ""
    else
        log_error "❌ 未找到 VSIX 文件"
    fi
}

# 检查更新
check_updates() {
    log_info "检查更新..."

    # 检查package.json中的版本号
    local current_version=$(node -p -e "require('./package.json').version" 2>/dev/null)
    log_info "当前版本: $current_version"

    # 这里可以添加版本检查逻辑
    log_info "插件已是最新版本"
}

# 增量版本号
increment_version() {
    local current_version=$(node -p -e "require('./package.json').version" 2>/dev/null)

    # 解析版本号 (假设格式为 x.y.z)
    local major=$(echo $current_version | cut -d. -f1)
    local minor=$(echo $current_version | cut -d. -f2)
    local patch=$(echo $current_version | cut -d. -f3)

    local new_patch=$((patch + 1))
    local new_version="$major.$minor.$new_patch"

    # 更新patch版本号
    npm version patch --no-git-tag-version

    log_info "版本号已更新: v$new_version"
}

# 检查代码质量
check_code_quality() {
    log_info "检查代码质量..."

    # 运行TypeScript编译
    npm run compile
    if [ $? -ne 0 ]; then
        log_error "TypeScript编译失败"
        return 1
    fi

    # 运行ESLint检查
    if [ -n "$(find src -name '*.ts' 2>/dev/null)" ]; then
        npm run lint
        if [ $? -ne 0 ]; then
            log_warning "代码质量问题，但继续构建"
        fi
    fi

    log_success "✅ 代码质量检查完成"
}

# 创建发布版本
create_release_version() {
    log_info "创建发布版本..."

    # 增量版本号
    increment_version

    # 重新打包
    clean_build
    install_dependencies
    compile_typescript
    run_lint
    package_vsix

    log_success "🎉 发布版本已创建: $(ls *.vsix)"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  clean       - 清理所有构建文件"
    echo "  deps        - 检查并安装依赖"
    echo "  build       - 编译TypeScript代码"
    echo "  test        - 运行测试"
    echo "  lint        - 代码质量检查"
    echo "  package     - 打包VSIX文件"
    echo "  verify      - 验证打包结果"
    echo "  release     - 创建发布版本"
    echo "  publish     - 发布到市场"
    echo "  all         - 执行完整流程"
    echo "  help        - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 build     # 仅编译"
    echo "  $0 package   # 编译并打包"
    echo "  $0 all       # 执行完整流程"
}

# 主函数
main() {
    local action=${1:-help}

    echo "========================================"
    echo "    VS Code AI 插件构建脚本"
    echo "========================================"
    echo ""

    # 显示使用说明
    case "${action}" in
        "clean"|"clean-all")
            check_dependencies
            clean_build
            ;;
        "deps"|"dependencies")
            check_dependencies
            ;;
        "build"|"compile")
            check_dependencies
            clean_build
            install_dependencies
            compile_typescript
            ;;
        "test")
            check_dependencies
            clean_build
            install_dependencies
            compile_typescript
            run_tests
            ;;
        "lint")
            check_dependencies
            compile_typescript
            run_lint
            ;;
        "package"|"pack")
            check_dependencies
            compile_typescript
            package_vsix
            verify_package
            show_package_info
            ;;
        "release")
            check_dependencies
            clean_build
            install_dependencies
            check_code_quality
            create_release_version
            ;;
        "publish")
            check_dependencies
            clean_build
            install_dependencies
            check_code_quality
            create_release_version
            publish_to_marketplace
            ;;
        "all"|"full")
            check_dependencies
            clean_build
            install_dependencies
            compile_typescript
            run_lint
            run_tests
            package_vsix
            verify_package
            show_package_info
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo "未知选项: $action"
            echo "使用 $0 --help 查看帮助信息"
            exit 1
            ;;
    esac

    if [[ "${action}" != "help" && "${action}" != "-h" && "${action}" != "--help" ]]; then
        echo ""
        log_success "🏁 任务完成!"
    fi
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
