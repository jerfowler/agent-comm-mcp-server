#!/bin/bash
"""
Protection Status Prompt Integration
Modifies shell prompt to show protection status and provides smart reminders
"""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Protection status indicators
SHIELD_ACTIVE="🛡️"
SHIELD_INACTIVE="⚠️"
GIT_PROTECTED="🔒"
GIT_UNPROTECTED="🔓"

# Smart prompt that shows protection status
generate_protection_prompt() {
    local git_status=""
    local protection_status=""
    local risk_level=""
    
    # Check if in git repo
    if git rev-parse --git-dir >/dev/null 2>&1; then
        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            git_status="$GIT_UNPROTECTED"  # Uncommitted changes = risk
            risk_level="HIGH"
        else
            git_status="$GIT_PROTECTED"   # Clean repo = lower risk
            risk_level="LOW"
        fi
    fi
    
    # Check protection active status
    if alias rm 2>/dev/null | grep -q "BLOCKED\|safe"; then
        protection_status="$SHIELD_ACTIVE"
    else
        protection_status="$SHIELD_INACTIVE"
        if [[ "$risk_level" == "HIGH" ]]; then
            # Show warning for high-risk, unprotected state
            protection_status="${RED}$SHIELD_INACTIVE${NC}"
        fi
    fi
    
    echo "$protection_status$git_status"
}

# Enhanced PS1 with protection status
setup_protection_prompt() {
    # Save original PS1 if not already saved
    if [[ -z "$ORIGINAL_PS1" ]]; then
        export ORIGINAL_PS1="$PS1"
    fi
    
    # Create new PS1 with protection status
    local protection_prompt="\$(generate_protection_prompt)"
    export PS1="$protection_prompt $ORIGINAL_PS1"
    
    echo -e "${GREEN}✅ Protection status prompt enabled${NC}"
}

# Restore original prompt
restore_original_prompt() {
    if [[ -n "$ORIGINAL_PS1" ]]; then
        export PS1="$ORIGINAL_PS1"
        echo -e "${YELLOW}⚪ Original prompt restored${NC}"
    fi
}

# Daily protection reminder (via cron)
daily_protection_reminder() {
    local reminder_file="$HOME/.claude/last_protection_reminder"
    local today=$(date +%Y-%m-%d)
    
    # Check if we already reminded today
    if [[ -f "$reminder_file" ]] && [[ "$(cat $reminder_file)" == "$today" ]]; then
        return 0
    fi
    
    echo -e "${PURPLE}📅 Daily Protection System Reminder${NC}"
    echo -e "${YELLOW}💡 Remember to enable protection in development sessions${NC}"
    echo -e "${GREEN}🛡️ Quick command: 'enable_protection'${NC}"
    
    # Mark reminder as shown today
    echo "$today" > "$reminder_file"
}

# Smart context-based reminders
smart_protection_reminder() {
    local current_dir=$(pwd)
    local risky_indicators=(
        "src/"
        "lib/"
        "test/"
        ".git/"
        "package.json"
        "tsconfig.json"
        "pyproject.toml"
        "Cargo.toml"
    )
    
    # Check if we're in a development context
    local in_dev_context=false
    for indicator in "${risky_indicators[@]}"; do
        if [[ -e "$indicator" ]]; then
            in_dev_context=true
            break
        fi
    done
    
    # If in dev context but protection not enabled
    if [[ "$in_dev_context" == true ]] && ! alias rm 2>/dev/null | grep -q "safe"; then
        echo -e "${YELLOW}💡 SUGGESTION: Development context detected - consider 'enable_protection'${NC}"
    fi
}

# Command history analysis for risky patterns
analyze_recent_commands() {
    local recent_commands=$(history 10)
    local risky_patterns=(
        "rm.*-rf"
        "git.*reset.*--hard" 
        "git.*clean"
        "truncate"
        "dd.*of="
    )
    
    for pattern in "${risky_patterns[@]}"; do
        if echo "$recent_commands" | grep -qE "$pattern"; then
            echo -e "${RED}⚠️ RISKY COMMAND DETECTED in recent history${NC}"
            echo -e "${YELLOW}💡 Consider enabling protection: 'enable_protection'${NC}"
            return 0
        fi
    done
}

# Weekly protection usage report
weekly_protection_report() {
    echo -e "${PURPLE}📊 Weekly Protection System Report${NC}"
    
    # Simple stats tracking
    local stats_file="$HOME/.claude/protection_stats.log"
    if [[ -f "$stats_file" ]]; then
        echo -e "${BLUE}📈 Usage Statistics:${NC}"
        tail -20 "$stats_file"
    fi
    
    echo -e "${GREEN}🎯 Recommendation: Review and adjust protection settings${NC}"
}

# Installation function
install_protection_prompt() {
    echo -e "${PURPLE}🔧 Installing Protection Prompt Integration${NC}"
    
    # Add to bashrc if not already present
    local bashrc="$HOME/.bashrc"
    local integration_line="source $(pwd)/protection-prompt-integration.sh"
    
    if [[ -f "$bashrc" ]] && ! grep -q "protection-prompt-integration" "$bashrc"; then
        echo "" >> "$bashrc"
        echo "# Claude Code Protection Prompt Integration" >> "$bashrc"
        echo "$integration_line" >> "$bashrc"
        echo -e "${GREEN}✅ Added to ~/.bashrc${NC}"
        echo -e "${YELLOW}💡 Restart shell or run: source ~/.bashrc${NC}"
    fi
    
    # Setup initial prompt
    setup_protection_prompt
}

# Uninstall function
uninstall_protection_prompt() {
    restore_original_prompt
    
    # Remove from bashrc
    local bashrc="$HOME/.bashrc"
    if [[ -f "$bashrc" ]]; then
        sed -i '/protection-prompt-integration/d' "$bashrc"
        sed -i '/Claude Code Protection Prompt/d' "$bashrc"
        echo -e "${YELLOW}⚪ Removed from ~/.bashrc${NC}"
    fi
}

# Main execution logic
case "${1:-help}" in
    "install")
        install_protection_prompt
        ;;
    "uninstall") 
        uninstall_protection_prompt
        ;;
    "setup")
        setup_protection_prompt
        ;;
    "restore")
        restore_original_prompt
        ;;
    "reminder")
        daily_protection_reminder
        ;;
    "analyze")
        analyze_recent_commands
        ;;
    "report")
        weekly_protection_report
        ;;
    "help"|*)
        echo -e "${PURPLE}Protection Prompt Integration Commands:${NC}"
        echo "  install   - Install protection prompt integration"
        echo "  uninstall - Remove protection prompt integration" 
        echo "  setup     - Enable protection status in prompt"
        echo "  restore   - Restore original prompt"
        echo "  reminder  - Show daily protection reminder"
        echo "  analyze   - Analyze recent commands for risks"
        echo "  report    - Show weekly protection usage report"
        ;;
esac

# Auto-setup when sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    echo -e "${GREEN}🎯 Protection prompt integration loaded${NC}"
    setup_protection_prompt
    smart_protection_reminder
fi