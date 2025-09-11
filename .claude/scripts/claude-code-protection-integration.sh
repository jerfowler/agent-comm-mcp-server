#!/bin/bash
"""
Claude Code Protection Integration
Automatically manages protection during Claude Code sessions
"""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Session tracking
SESSION_FILE="$HOME/.claude/current_session"
PROTECTION_LOG="$HOME/.claude/protection_session.log"

# Claude Code session start
claude_session_start() {
    echo -e "${PURPLE}🤖 Claude Code session starting...${NC}"
    
    # Create session marker
    echo "$(date -Iseconds)" > "$SESSION_FILE"
    
    # Auto-enable protection based on context
    auto_enable_session_protection
    
    # Show session protection status
    show_session_status
    
    # Log session start
    log_protection_event "SESSION_START" "Claude Code session initiated"
}

# Auto-enable protection logic
auto_enable_session_protection() {
    local auto_enable_reasons=()
    
    # Check for development indicators
    if [[ -f "package.json" ]]; then
        auto_enable_reasons+=("Node.js project detected")
    fi
    
    if [[ -f "pyproject.toml" ]] || [[ -f "requirements.txt" ]]; then
        auto_enable_reasons+=("Python project detected") 
    fi
    
    if [[ -f "Cargo.toml" ]]; then
        auto_enable_reasons+=("Rust project detected")
    fi
    
    if [[ -f "tsconfig.json" ]]; then
        auto_enable_reasons+=("TypeScript project detected")
    fi
    
    # Check for git repo with changes
    if git rev-parse --git-dir >/dev/null 2>&1; then
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            auto_enable_reasons+=("Git repo with uncommitted changes")
        fi
    fi
    
    # Check for critical directories
    for dir in src lib tests docs; do
        if [[ -d "$dir" ]]; then
            auto_enable_reasons+=("Critical directory '$dir' present")
            break
        fi
    done
    
    # Auto-enable if any reasons found
    if [[ ${#auto_enable_reasons[@]} -gt 0 ]]; then
        echo -e "${YELLOW}🛡️ Auto-enabling protection based on:${NC}"
        for reason in "${auto_enable_reasons[@]}"; do
            echo -e "  ${BLUE}• $reason${NC}"
        done
        
        # Enable protection
        enable_claude_session_protection
        
        log_protection_event "AUTO_ENABLE" "Reasons: ${auto_enable_reasons[*]}"
    else
        echo -e "${GREEN}💡 No auto-enable triggers found - manual control available${NC}"
        echo -e "${PURPLE}💡 Use 'enable_protection' if working with critical files${NC}"
    fi
}

# Enable protection for Claude session
enable_claude_session_protection() {
    # Source verification aliases if available
    if [[ -f ".claude/hooks/verification-aliases.sh" ]]; then
        source .claude/hooks/verification-aliases.sh
        setup-protection-overrides 2>/dev/null
        echo -e "${GREEN}✅ Project protection enabled${NC}"
    elif [[ -f "$HOME/.claude/hooks/verification-aliases.sh" ]]; then
        source "$HOME/.claude/hooks/verification-aliases.sh"
        setup-protection-overrides 2>/dev/null
        echo -e "${GREEN}✅ Global protection enabled${NC}"
    fi
    
    # Update prompt
    if [[ "$PS1" != *"🛡️"* ]]; then
        export PS1="🛡️ $PS1"
    fi
    
    # Set environment marker
    export CLAUDE_PROTECTION_ACTIVE="true"
}

# Session status display
show_session_status() {
    echo -e "${PURPLE}📊 Claude Code Session Status:${NC}"
    echo -e "  ${BLUE}Session file: $(basename $SESSION_FILE)${NC}"
    echo -e "  ${BLUE}Working directory: $(pwd)${NC}"
    echo -e "  ${BLUE}Git repo: $(git rev-parse --git-dir >/dev/null 2>&1 && echo 'Yes' || echo 'No')${NC}"
    
    # Protection status
    if [[ "$CLAUDE_PROTECTION_ACTIVE" == "true" ]]; then
        echo -e "  ${GREEN}Protection: ACTIVE 🛡️${NC}"
    else
        echo -e "  ${YELLOW}Protection: INACTIVE ⚠️${NC}"
    fi
    
    echo ""
}

# Claude Code session end
claude_session_end() {
    echo -e "${PURPLE}🤖 Claude Code session ending...${NC}"
    
    # Show session summary
    show_session_summary
    
    # Clean up session marker
    rm -f "$SESSION_FILE" 2>/dev/null
    
    # Optionally disable protection (user choice)
    if [[ "$CLAUDE_PROTECTION_ACTIVE" == "true" ]]; then
        echo -e "${YELLOW}🛡️ Protection currently active${NC}"
        echo -e "${BLUE}💡 Use 'disable_protection' to disable, or leave active for continued protection${NC}"
    fi
    
    # Log session end
    log_protection_event "SESSION_END" "Claude Code session completed"
}

# Session summary
show_session_summary() {
    if [[ -f "$SESSION_FILE" ]]; then
        local session_start=$(cat "$SESSION_FILE")
        local session_duration=$(($(date +%s) - $(date -d "$session_start" +%s)))
        local duration_formatted=$(date -d@$session_duration -u +%H:%M:%S)
        
        echo -e "${PURPLE}📈 Session Summary:${NC}"
        echo -e "  ${BLUE}Duration: $duration_formatted${NC}"
        echo -e "  ${BLUE}Protection events: $(grep -c "$(date +%Y-%m-%d)" "$PROTECTION_LOG" 2>/dev/null || echo 0)${NC}"
        
        # Check for any risky commands executed
        local risky_count=$(history 50 | grep -cE "(rm.*-rf|git.*reset.*--hard|git.*clean)" || echo 0)
        if [[ "$risky_count" -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠️ Risky commands detected: $risky_count${NC}"
            echo -e "  ${GREEN}💡 Consider reviewing command history for safety${NC}"
        fi
    fi
}

# Logging function
log_protection_event() {
    local event_type="$1"
    local details="$2"
    local timestamp=$(date -Iseconds)
    
    mkdir -p "$(dirname "$PROTECTION_LOG")"
    echo "$timestamp [$event_type] $details" >> "$PROTECTION_LOG"
}

# Quick status check
protection_quick_status() {
    if [[ -f "$SESSION_FILE" ]]; then
        echo -e "${GREEN}🤖 Claude Code session ACTIVE${NC}"
    else
        echo -e "${YELLOW}🤖 Claude Code session INACTIVE${NC}"
    fi
    
    if [[ "$CLAUDE_PROTECTION_ACTIVE" == "true" ]]; then
        echo -e "${GREEN}🛡️ Protection ACTIVE${NC}"
    else
        echo -e "${RED}⚠️ Protection INACTIVE${NC}"
    fi
}

# Integration with .bashrc for automatic session detection
setup_claude_integration() {
    echo -e "${PURPLE}🔧 Setting up Claude Code integration${NC}"
    
    local bashrc="$HOME/.bashrc"
    local integration_block="
# Claude Code Protection Integration
export CLAUDE_CODE_PROTECTION_SCRIPT='$(pwd)/claude-code-protection-integration.sh'
alias claude-start='source \$CLAUDE_CODE_PROTECTION_SCRIPT && claude_session_start'
alias claude-end='source \$CLAUDE_CODE_PROTECTION_SCRIPT && claude_session_end'
alias claude-status='source \$CLAUDE_CODE_PROTECTION_SCRIPT && protection_quick_status'
"
    
    if [[ -f "$bashrc" ]] && ! grep -q "Claude Code Protection Integration" "$bashrc"; then
        echo "$integration_block" >> "$bashrc"
        echo -e "${GREEN}✅ Integration added to ~/.bashrc${NC}"
        echo -e "${YELLOW}💡 Available commands: claude-start, claude-end, claude-status${NC}"
        echo -e "${BLUE}💡 Restart shell or run: source ~/.bashrc${NC}"
    fi
}

# Command line interface
case "${1:-help}" in
    "start")
        claude_session_start
        ;;
    "end")
        claude_session_end
        ;;
    "status")
        show_session_status
        ;;
    "quick-status")
        protection_quick_status
        ;;
    "setup")
        setup_claude_integration
        ;;
    "enable")
        enable_claude_session_protection
        ;;
    "summary")
        show_session_summary
        ;;
    "log")
        if [[ -f "$PROTECTION_LOG" ]]; then
            tail -20 "$PROTECTION_LOG"
        else
            echo "No protection log found"
        fi
        ;;
    "help"|*)
        echo -e "${PURPLE}Claude Code Protection Integration:${NC}"
        echo "  start        - Start Claude Code session with protection"
        echo "  end          - End Claude Code session"
        echo "  status       - Show detailed session status"
        echo "  quick-status - Quick protection status check"
        echo "  setup        - Install shell integration"
        echo "  enable       - Manually enable protection"
        echo "  summary      - Show session summary"
        echo "  log          - Show recent protection events"
        ;;
esac

# Auto-setup when sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    echo -e "${GREEN}🤖 Claude Code protection integration loaded${NC}"
fi