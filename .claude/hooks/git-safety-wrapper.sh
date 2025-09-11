#!/bin/bash
"""
Git Safety Wrapper - Intelligent Git Command Protection
Provides safety checks and automatic protection for all git operations

This wrapper:
1. Intercepts all git commands before execution
2. Analyzes git operations for destructive patterns
3. Creates automatic backups for risky operations  
4. Provides intelligent recovery suggestions
5. Integrates with existing protection systems
6. Offers git-specific safety protocols

Usage:
  # Install wrapper (replaces 'git' command in PATH)
  ./git-safety-wrapper.sh install
  
  # Remove wrapper (restores original git)
  ./git-safety-wrapper.sh uninstall
  
  # Use as direct wrapper
  ./git-safety-wrapper.sh <git-command> [args...]
  
  # Check wrapper status
  ./git-safety-wrapper.sh status

Environment Variables:
  GIT_SAFETY_MODE=strict      # strict/normal/disabled (default: normal)
  GIT_SAFETY_AUTO_BACKUP=1    # Enable automatic backups (default: 1)  
  GIT_SAFETY_DEBUG=1          # Enable debug output
"""

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
GIT_BINARY="/usr/bin/git"  # Path to real git binary
DESTRUCTIVE_GUARD="$SCRIPT_DIR/destructive-operation-guard.py"
RECOVERY_ASSISTANT="$SCRIPT_DIR/recovery-assistant.py"

# Safety configuration from environment
SAFETY_MODE="${GIT_SAFETY_MODE:-normal}"          # strict/normal/disabled
AUTO_BACKUP="${GIT_SAFETY_AUTO_BACKUP:-1}"        # 1=enabled, 0=disabled
DEBUG_MODE="${GIT_SAFETY_DEBUG:-0}"               # 1=enabled, 0=disabled

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
debug_log() {
    if [[ "$DEBUG_MODE" == "1" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} Git Safety: $1" >&2
    fi
}

info_log() {
    echo -e "${CYAN}[INFO]${NC} Git Safety: $1" >&2
}

warning_log() {
    echo -e "${YELLOW}[WARNING]${NC} Git Safety: $1" >&2
}

error_log() {
    echo -e "${RED}[ERROR]${NC} Git Safety: $1" >&2
}

success_log() {
    echo -e "${GREEN}[SUCCESS]${NC} Git Safety: $1" >&2
}

# Check if we're in a git repository
is_git_repo() {
    "$GIT_BINARY" rev-parse --git-dir >/dev/null 2>&1
}

# Get current git status for context
get_git_context() {
    local context=""
    
    if ! is_git_repo; then
        echo "not_git_repo"
        return
    fi
    
    # Check for uncommitted changes
    if ! "$GIT_BINARY" diff-index --quiet HEAD -- 2>/dev/null; then
        context="${context}uncommitted_changes,"
    fi
    
    # Check for staged changes
    if ! "$GIT_BINARY" diff-index --quiet --cached HEAD -- 2>/dev/null; then
        context="${context}staged_changes,"
    fi
    
    # Check for untracked files
    if [[ -n "$("$GIT_BINARY" ls-files --others --exclude-standard)" ]]; then
        context="${context}untracked_files,"
    fi
    
    # Check current branch
    local branch=$("$GIT_BINARY" branch --show-current 2>/dev/null)
    if [[ "$branch" == "main" ]] || [[ "$branch" == "master" ]]; then
        context="${context}main_branch,"
    fi
    
    echo "${context%,}"  # Remove trailing comma
}

# Analyze git command for risk level
analyze_git_command() {
    local cmd="$1"
    local args=("${@:2}")
    local full_command="git $cmd ${args[*]}"
    
    debug_log "Analyzing: $full_command"
    
    # Define risk patterns for git commands
    case "$cmd" in
        "reset")
            if [[ " ${args[*]} " =~ " --hard " ]]; then
                echo "critical"
                return
            elif [[ " ${args[*]} " =~ " HEAD~" ]] || [[ " ${args[*]} " =~ " HEAD^" ]]; then
                echo "dangerous"
                return
            fi
            ;;
        "clean")
            if [[ " ${args[*]} " =~ " -f" ]] || [[ " ${args[*]} " =~ " -d" ]]; then
                echo "dangerous"
                return
            fi
            ;;
        "checkout")
            if [[ " ${args[*]} " =~ " -- " ]]; then
                echo "dangerous"
                return
            fi
            ;;
        "branch")
            if [[ " ${args[*]} " =~ " -D " ]]; then
                echo "dangerous"
                return
            fi
            ;;
        "stash")
            if [[ " ${args[*]} " =~ " drop " ]] || [[ " ${args[*]} " =~ " clear " ]]; then
                echo "risky"
                return
            fi
            ;;
        "push")
            if [[ " ${args[*]} " =~ " --force" ]]; then
                echo "critical"
                return
            fi
            ;;
        "rebase")
            if [[ " ${args[*]} " =~ " -i " ]] || [[ " ${args[*]} " =~ " --interactive " ]]; then
                echo "risky"
                return
            fi
            ;;
        "merge"|"pull")
            # Generally safe but can cause conflicts
            echo "safe"
            return
            ;;
    esac
    
    echo "safe"
}

# Create automatic backup based on command risk
create_automatic_backup() {
    local cmd="$1"
    local risk_level="$2"
    local context="$3"
    
    if [[ "$AUTO_BACKUP" != "1" ]]; then
        debug_log "Auto-backup disabled"
        return 0
    fi
    
    if [[ "$risk_level" == "safe" ]]; then
        debug_log "No backup needed for safe operation"
        return 0
    fi
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_created=0
    
    debug_log "Creating automatic backup for $risk_level operation"
    
    # Create stash backup if there are changes
    if [[ "$context" =~ "uncommitted_changes" ]] || [[ "$context" =~ "staged_changes" ]] || [[ "$context" =~ "untracked_files" ]]; then
        local stash_name="git-safety-backup-$cmd-$timestamp"
        if "$GIT_BINARY" stash push -m "$stash_name" --include-untracked >/dev/null 2>&1; then
            info_log "🛡️ Created stash backup: $stash_name"
            backup_created=1
        fi
    fi
    
    # Create branch backup for dangerous/critical operations
    if [[ "$risk_level" == "dangerous" ]] || [[ "$risk_level" == "critical" ]]; then
        local backup_branch="safety-backup-$cmd-$timestamp"
        if "$GIT_BINARY" branch "$backup_branch" >/dev/null 2>&1; then
            info_log "🛡️ Created branch backup: $backup_branch"
            backup_created=1
        fi
    fi
    
    # Create reflog backup reference for critical operations
    if [[ "$risk_level" == "critical" ]]; then
        local backup_tag="safety-tag-$cmd-$timestamp"
        if "$GIT_BINARY" tag "$backup_tag" HEAD >/dev/null 2>&1; then
            info_log "🛡️ Created tag backup: $backup_tag"
            backup_created=1
        fi
    fi
    
    return $backup_created
}

# Get user confirmation for risky operations
get_user_confirmation() {
    local cmd="$1"
    local risk_level="$2"
    local context="$3"
    local full_command="git $cmd ${*:4}"
    
    case "$risk_level" in
        "critical")
            echo -e "${RED}🚨 CRITICAL GIT OPERATION${NC}"
            echo "Command: $full_command"
            echo "Risk: This operation WILL lose data or history"
            if [[ "$context" =~ "uncommitted_changes" ]]; then
                echo "⚠️ You have uncommitted changes that may be lost"
            fi
            echo
            read -p "Type 'I understand the risks' to proceed: " response
            [[ "$response" == "I understand the risks" ]]
            ;;
        "dangerous")
            echo -e "${YELLOW}⚠️ DANGEROUS GIT OPERATION${NC}"
            echo "Command: $full_command"
            echo "Risk: This operation could lose work or changes"
            if [[ "$context" =~ "main_branch" ]]; then
                echo "⚠️ You are on the main/master branch"
            fi
            echo
            read -p "Proceed? (yes/no): " response
            [[ "$response" == "yes" ]]
            ;;
        "risky")
            echo -e "${CYAN}🤔 RISKY GIT OPERATION${NC}"
            echo "Command: $full_command"
            echo "Risk: This operation needs careful consideration"
            echo
            read -p "Continue? (y/n): " response
            [[ "$response" =~ ^[Yy]$ ]]
            ;;
        *)
            return 0  # Safe operations don't need confirmation
            ;;
    esac
}

# Show recovery suggestions after failed operations
show_recovery_suggestions() {
    local cmd="$1"
    local risk_level="$2"
    local exit_code="$3"
    
    if [[ "$exit_code" == "0" ]]; then
        return  # Operation succeeded
    fi
    
    echo -e "${RED}❌ Git operation failed${NC}"
    echo "Command: git $cmd"
    echo "Exit code: $exit_code"
    echo
    
    case "$cmd" in
        "reset")
            echo -e "${CYAN}🛡️ Recovery options:${NC}"
            echo "  • git reflog                     # View recent operations"
            echo "  • git reset HEAD@{1}             # Undo the reset"
            echo "  • git stash pop                  # Restore stashed changes"
            ;;
        "clean")
            echo -e "${CYAN}🛡️ Recovery options:${NC}"
            echo "  • Check .git-clean-backup-*      # Look for backup directory"
            echo "  • git status                     # See current state"
            ;;
        "checkout")
            echo -e "${CYAN}🛡️ Recovery options:${NC}"
            echo "  • git checkout -                 # Return to previous branch"
            echo "  • git reflog                     # View checkout history"
            echo "  • git stash pop                  # Restore stashed changes"
            ;;
        "merge"|"pull")
            echo -e "${CYAN}🛡️ Recovery options:${NC}"
            echo "  • git merge --abort              # Abort failed merge"
            echo "  • git reset --merge              # Reset merge state"
            echo "  • git status                     # View merge conflicts"
            ;;
        "rebase")
            echo -e "${CYAN}🛡️ Recovery options:${NC}"
            echo "  • git rebase --abort             # Abort failed rebase"
            echo "  • git reflog                     # View rebase history"
            echo "  • git reset --hard ORIG_HEAD     # Reset to pre-rebase state"
            ;;
        *)
            echo -e "${CYAN}🛡️ General recovery options:${NC}"
            echo "  • git reflog                     # View operation history"
            echo "  • git status                     # Check current state"
            if [[ -x "$RECOVERY_ASSISTANT" ]]; then
                echo "  • $RECOVERY_ASSISTANT recover    # Use recovery assistant"
            fi
            ;;
    esac
}

# Show post-operation safety report
show_post_operation_report() {
    local cmd="$1"
    local risk_level="$2"
    local exit_code="$3"
    local backup_created="$4"
    
    if [[ "$exit_code" != "0" ]]; then
        show_recovery_suggestions "$cmd" "$risk_level" "$exit_code"
        return
    fi
    
    if [[ "$risk_level" != "safe" ]]; then
        echo -e "${GREEN}✅ Git operation completed safely${NC}"
        
        if [[ "$backup_created" == "1" ]]; then
            echo "🛡️ Backups were created before operation"
            echo "   • Check git stash list for stash backups"
            echo "   • Check git branch -a for branch backups"  
            echo "   • Check git tag -l for tag backups"
        fi
        
        # Suggest cleanup for successful risky operations
        if [[ "$risk_level" == "risky" ]] && [[ "$backup_created" == "1" ]]; then
            echo
            echo -e "${YELLOW}💡 Cleanup suggestion:${NC}"
            echo "   Consider removing old backup branches/tags if operation was successful"
        fi
    fi
}

# Main git command wrapper
execute_git_command() {
    local cmd="$1"
    shift
    local args=("$@")
    
    debug_log "Executing git command: $cmd ${args[*]}"
    
    # Skip safety checks for certain safe commands
    local safe_commands=("status" "log" "show" "diff" "branch" "remote" "config" "help")
    for safe_cmd in "${safe_commands[@]}"; do
        if [[ "$cmd" == "$safe_cmd" ]]; then
            debug_log "Safe command, executing directly"
            exec "$GIT_BINARY" "$cmd" "${args[@]}"
        fi
    done
    
    # Skip if safety is disabled
    if [[ "$SAFETY_MODE" == "disabled" ]]; then
        debug_log "Safety disabled, executing directly"
        exec "$GIT_BINARY" "$cmd" "${args[@]}"
    fi
    
    # Analyze command and context
    local risk_level=$(analyze_git_command "$cmd" "${args[@]}")
    local context=$(get_git_context)
    
    debug_log "Risk level: $risk_level, Context: $context"
    
    # Use external destructive guard for critical operations
    if [[ "$risk_level" == "critical" ]] && [[ -x "$DESTRUCTIVE_GUARD" ]]; then
        local full_command="git $cmd ${args[*]}"
        info_log "🛡️ Checking operation with destructive guard"
        
        if ! python3 "$DESTRUCTIVE_GUARD" verify-safety "$full_command"; then
            error_log "Operation blocked by destructive guard"
            exit 1
        fi
    fi
    
    # Create automatic backups
    local backup_created=0
    create_automatic_backup "$cmd" "$risk_level" "$context"
    backup_created=$?
    
    # Get user confirmation for risky operations in strict mode
    if [[ "$SAFETY_MODE" == "strict" ]] || [[ "$risk_level" == "critical" ]]; then
        if ! get_user_confirmation "$cmd" "$risk_level" "$context" "${args[@]}"; then
            warning_log "Operation cancelled by user"
            exit 1
        fi
    fi
    
    # Execute the git command
    info_log "Executing: git $cmd ${args[*]}"
    "$GIT_BINARY" "$cmd" "${args[@]}"
    local exit_code=$?
    
    # Show post-operation report
    show_post_operation_report "$cmd" "$risk_level" "$exit_code" "$backup_created"
    
    exit $exit_code
}

# Installation functions
install_wrapper() {
    local install_dir="/usr/local/bin"
    local wrapper_name="git"
    
    echo -e "${PURPLE}🛡️ Installing Git Safety Wrapper${NC}"
    
    # Check if we have write permissions
    if [[ ! -w "$install_dir" ]]; then
        error_log "No write permission to $install_dir"
        echo "Try: sudo $0 install"
        exit 1
    fi
    
    # Backup original git if it exists
    if [[ -f "$install_dir/$wrapper_name" ]] && [[ ! -L "$install_dir/$wrapper_name" ]]; then
        local backup_name="git.original"
        cp "$install_dir/$wrapper_name" "$install_dir/$backup_name"
        info_log "Backed up original git to $install_dir/$backup_name"
    fi
    
    # Create wrapper script
    cat > "$install_dir/$wrapper_name" << EOF
#!/bin/bash
# Git Safety Wrapper - Auto-generated
export GIT_SAFETY_ORIGINAL_PATH="$install_dir/git.original"
exec "$SCRIPT_PATH" "\$@"
EOF
    
    chmod +x "$install_dir/$wrapper_name"
    success_log "Git safety wrapper installed to $install_dir/$wrapper_name"
    
    echo
    echo -e "${CYAN}Configuration:${NC}"
    echo "  GIT_SAFETY_MODE=strict      # Enable strict mode"
    echo "  GIT_SAFETY_AUTO_BACKUP=0    # Disable auto-backups"
    echo "  GIT_SAFETY_DEBUG=1          # Enable debug output"
    echo
    echo -e "${YELLOW}Test the installation:${NC}"
    echo "  git status                   # Should work normally"
    echo "  git reset --hard HEAD~1      # Should show safety prompts"
}

uninstall_wrapper() {
    local install_dir="/usr/local/bin"
    local wrapper_name="git"
    local backup_name="git.original"
    
    echo -e "${PURPLE}🗑️ Uninstalling Git Safety Wrapper${NC}"
    
    # Check if wrapper is installed
    if [[ ! -f "$install_dir/$wrapper_name" ]]; then
        warning_log "Git safety wrapper not found at $install_dir/$wrapper_name"
        exit 1
    fi
    
    # Restore original git
    if [[ -f "$install_dir/$backup_name" ]]; then
        mv "$install_dir/$backup_name" "$install_dir/$wrapper_name"
        success_log "Restored original git from backup"
    else
        rm -f "$install_dir/$wrapper_name"
        warning_log "Removed wrapper but no backup found - you may need to reinstall git"
    fi
    
    success_log "Git safety wrapper uninstalled"
}

show_status() {
    echo -e "${PURPLE}🛡️ Git Safety Wrapper Status${NC}"
    echo
    
    # Check if wrapper is installed
    local git_path=$(which git)
    echo "Git command path: $git_path"
    
    if [[ -L "$git_path" ]]; then
        echo "Status: Wrapper installed (symlink)"
        echo "Target: $(readlink "$git_path")"
    elif grep -q "Git Safety Wrapper" "$git_path" 2>/dev/null; then
        echo "Status: Wrapper installed (script)"
    else
        echo "Status: Original git (wrapper not installed)"
    fi
    
    echo
    echo -e "${CYAN}Current Configuration:${NC}"
    echo "  Safety Mode: $SAFETY_MODE"
    echo "  Auto Backup: $([ "$AUTO_BACKUP" == "1" ] && echo "Enabled" || echo "Disabled")"
    echo "  Debug Mode: $([ "$DEBUG_MODE" == "1" ] && echo "Enabled" || echo "Disabled")"
    
    echo
    echo -e "${CYAN}Git Context:${NC}"
    if is_git_repo; then
        local context=$(get_git_context)
        echo "  Repository: Yes"
        echo "  Context: ${context:-clean}"
        echo "  Branch: $("$GIT_BINARY" branch --show-current 2>/dev/null || echo "unknown")"
    else
        echo "  Repository: No"
    fi
    
    echo
    echo -e "${CYAN}Protection Systems:${NC}"
    echo "  Destructive Guard: $([ -x "$DESTRUCTIVE_GUARD" ] && echo "Available" || echo "Missing")"
    echo "  Recovery Assistant: $([ -x "$RECOVERY_ASSISTANT" ] && echo "Available" || echo "Missing")"
}

# Main script logic
main() {
    local action="${1:-help}"
    
    case "$action" in
        "install")
            install_wrapper
            ;;
        "uninstall")
            uninstall_wrapper
            ;;
        "status")
            show_status
            ;;
        "help"|"--help"|"-h")
            echo -e "${PURPLE}🛡️ Git Safety Wrapper${NC}"
            echo
            echo "Usage:"
            echo "  $0 install                 # Install wrapper (requires sudo)"
            echo "  $0 uninstall               # Remove wrapper"
            echo "  $0 status                  # Show wrapper status"
            echo "  $0 <git-command> [args]    # Execute git command with safety"
            echo
            echo "Environment Variables:"
            echo "  GIT_SAFETY_MODE=strict     # strict/normal/disabled"
            echo "  GIT_SAFETY_AUTO_BACKUP=1   # Enable automatic backups"
            echo "  GIT_SAFETY_DEBUG=1         # Enable debug output"
            echo
            echo "Examples:"
            echo "  GIT_SAFETY_MODE=strict git reset --hard    # Strict mode"
            echo "  GIT_SAFETY_AUTO_BACKUP=0 git clean -fd     # No backups"
            ;;
        *)
            # Regular git command - execute with safety wrapper
            if [[ ! -x "$GIT_BINARY" ]]; then
                error_log "Git binary not found at $GIT_BINARY"
                exit 1
            fi
            
            execute_git_command "$@"
            ;;
    esac
}

# Run main function with all arguments
main "$@"