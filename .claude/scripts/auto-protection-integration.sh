#!/bin/bash
"""
Auto-Protection Integration System
Automatically enables protection based on context and risk assessment
"""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
CLAUDE_HOOKS_DIR="$HOME/.claude/hooks"
PROJECT_HOOKS_DIR=".claude/hooks"

# Override cd command to auto-enable protection in git repos
original_cd=$(which cd)
cd() {
    # Call original cd
    builtin cd "$@"
    
    # Check if we're now in a git repository
    if git rev-parse --git-dir >/dev/null 2>&1; then
        # Check if there are uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo -e "${YELLOW}🛡️ Auto-enabling protection - Git repo with uncommitted changes${NC}"
            auto_enable_protection
        fi
        
        # Check if project has .claude/hooks directory
        if [[ -d ".claude/hooks" ]]; then
            echo -e "${GREEN}📁 Project-specific protection available${NC}"
            source_project_protection
        fi
    fi
}

# Auto-enable protection function
auto_enable_protection() {
    if [[ -f "$CLAUDE_HOOKS_DIR/verification-aliases.sh" ]]; then
        source "$CLAUDE_HOOKS_DIR/verification-aliases.sh"
        setup-protection-overrides 2>/dev/null
        
        # Update prompt to show protection status
        export PS1="🛡️ $PS1"
        
        echo -e "${GREEN}✅ Protection automatically enabled${NC}"
        echo -e "${PURPLE}💡 Use 'disable-protection-overrides' to disable${NC}"
    fi
}

# Source project-specific protection
source_project_protection() {
    if [[ -f "$PROJECT_HOOKS_DIR/verification-aliases.sh" ]]; then
        source "$PROJECT_HOOKS_DIR/verification-aliases.sh"
        echo -e "${GREEN}📋 Project protection loaded${NC}"
    fi
}

# Claude Code session integration
claude_code_start() {
    echo -e "${PURPLE}🤖 Claude Code session starting${NC}"
    
    # Auto-enable if in development context
    if [[ -f "package.json" ]] || [[ -f "pyproject.toml" ]] || [[ -f "Cargo.toml" ]]; then
        echo -e "${YELLOW}🔧 Development project detected - enabling protection${NC}"
        auto_enable_protection
    fi
    
    # Show current protection status
    protection_status
}

# Protection status check
protection_status() {
    echo -e "${PURPLE}🛡️ Protection System Status:${NC}"
    
    if alias rm 2>/dev/null | grep -q "safe-rm"; then
        echo -e "${GREEN}  ✅ File deletion protection: ACTIVE${NC}"
    else
        echo -e "${RED}  ❌ File deletion protection: INACTIVE${NC}"
    fi
    
    if type git | grep -q "function"; then
        echo -e "${GREEN}  ✅ Git protection wrapper: ACTIVE${NC}" 
    else
        echo -e "${RED}  ❌ Git protection wrapper: INACTIVE${NC}"
    fi
    
    if [[ "$PS1" == *"🛡️"* ]]; then
        echo -e "${GREEN}  ✅ Visual indicator: ACTIVE${NC}"
    else
        echo -e "${RED}  ❌ Visual indicator: INACTIVE${NC}"
    fi
}

# Quick enable/disable commands
enable_protection() {
    auto_enable_protection
    echo -e "${GREEN}🛡️ Protection manually enabled${NC}"
}

disable_protection() {
    disable-protection-overrides 2>/dev/null
    export PS1=$(echo "$PS1" | sed 's/🛡️ //')
    echo -e "${YELLOW}⚠️ Protection manually disabled${NC}"
}

# Risky command detector with auto-prompt
check_risky_command() {
    local cmd="$1"
    local risky_patterns=(
        "rm.*-rf"
        "git.*reset.*--hard"
        "git.*clean.*-fd"
        "truncate.*-s.*0"
        "> .*\.(js|ts|py|json|md)"
    )
    
    for pattern in "${risky_patterns[@]}"; do
        if echo "$cmd" | grep -qE "$pattern"; then
            echo -e "${RED}⚠️ RISKY COMMAND DETECTED: $cmd${NC}"
            echo -e "${YELLOW}💡 Consider enabling protection: 'enable_protection'${NC}"
            return 0
        fi
    done
    return 1
}

# Bash history integration
if [[ "$0" == "$BASH_SOURCE" ]]; then
    echo "This script should be sourced, not executed."
    echo "Add to ~/.bashrc: source path/to/auto-protection-integration.sh"
else
    echo -e "${GREEN}🛡️ Auto-protection integration loaded${NC}"
    echo -e "${PURPLE}💡 Commands: enable_protection, disable_protection, protection_status${NC}"
    
    # Show immediate status
    protection_status
fi