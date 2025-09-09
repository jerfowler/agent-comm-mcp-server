#!/bin/bash
"""
Verification Aliases - Safe Command Redirects and Protection Integration
Provides safe alternatives and protection redirects for destructive operations

This script provides:
1. Safe aliases for common destructive operations
2. Automatic integration with destructive-operation-guard.py
3. Educational guidance for safer alternatives
4. Quick verification and recovery commands
5. Integration with reasoning-validator.py hooks

Usage:
  source .claude/hooks/verification-aliases.sh  # Load in shell session
  safe-reset                                   # Safe git reset alternative
  protected-clean                              # Protected git clean
  verify-safety "git reset --hard"             # Check operation safety
  recover-data                                 # Quick data recovery
"""

# Configuration
HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTRUCTIVE_GUARD="$HOOKS_DIR/destructive-operation-guard.py"
RECOVERY_ASSISTANT="$HOOKS_DIR/recovery-assistant.py"
REASONING_VALIDATOR="$HOOKS_DIR/reasoning-validator.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

# Core protection function - wraps dangerous operations
protect_operation() {
    local operation="$1"
    local auto_mode="${2:-false}"
    
    if [[ ! -x "$DESTRUCTIVE_GUARD" ]]; then
        log_error "Destructive operation guard not found or not executable"
        return 1
    fi
    
    log_info "🛡️ Analyzing operation safety: $operation"
    
    # Use destructive guard to protect the operation
    if [[ "$auto_mode" == "true" ]]; then
        python3 "$DESTRUCTIVE_GUARD" protect "$operation" --json
    else
        python3 "$DESTRUCTIVE_GUARD" protect "$operation" --interactive
    fi
    
    local exit_code=$?
    
    case $exit_code in
        0)
            log_success "Operation approved - executing safely"
            return 0
            ;;
        1)
            log_error "Operation blocked - dangerous without proper safeguards"
            return 1
            ;;
        2)
            log_warning "Operation approved with warnings - proceed carefully"
            return 0
            ;;
        3)
            log_error "Operation forbidden - critical data loss risk"
            return 1
            ;;
        *)
            log_error "Protection system error"
            return 1
            ;;
    esac
}

# SAFE ALIASES - Protected versions of dangerous operations

# Safe Git Reset - Always creates backup first
safe-reset() {
    local target="${1:-HEAD~1}"
    
    echo -e "${PURPLE}🔄 Safe Git Reset${NC}"
    echo "Target: $target"
    echo
    
    # Check if we have uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "${YELLOW}⚠️ Uncommitted changes detected${NC}"
        
        # Create stash backup
        local stash_name="safe-reset-backup-$(date +%Y%m%d-%H%M%S)"
        git stash push -m "$stash_name" --include-untracked
        log_info "Created backup stash: $stash_name"
    fi
    
    # Create branch backup
    local backup_branch="backup-before-reset-$(date +%Y%m%d-%H%M%S)"
    git branch "$backup_branch"
    log_info "Created backup branch: $backup_branch"
    
    # Show what will change
    echo -e "${CYAN}📊 Changes that will be made:${NC}"
    git log --oneline "$target"..HEAD
    echo
    
    # Confirm operation
    read -p "Proceed with reset to $target? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        git reset "$target"
        log_success "Reset completed safely with backups"
        echo "🛡️ Recovery options:"
        echo "  - Restore stash: git stash pop (if stash was created)"
        echo "  - Restore branch: git checkout $backup_branch"
    else
        log_info "Reset cancelled"
    fi
}

# Protected Git Clean - Shows what will be deleted first
protected-clean() {
    local flags="${1:--fd}"
    
    echo -e "${PURPLE}🧹 Protected Git Clean${NC}"
    echo "Flags: $flags"
    echo
    
    # Show what would be deleted
    echo -e "${YELLOW}📋 Files that would be deleted:${NC}"
    git clean -n $flags
    echo
    
    # Create backup if there are important untracked files
    local untracked_files=$(git clean -n $flags | wc -l)
    if [[ $untracked_files -gt 0 ]]; then
        echo -e "${CYAN}🛡️ Creating backup of untracked files...${NC}"
        local backup_dir=".git-clean-backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Copy untracked files to backup
        git clean -n $flags | cut -c 14- | while read -r file; do
            if [[ -f "$file" ]]; then
                local dir_path=$(dirname "$file")
                mkdir -p "$backup_dir/$dir_path"
                cp "$file" "$backup_dir/$file"
            fi
        done
        
        log_info "Backup created: $backup_dir"
    fi
    
    # Confirm operation
    read -p "Proceed with git clean $flags? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        git clean $flags
        log_success "Git clean completed safely"
        if [[ $untracked_files -gt 0 ]]; then
            echo "🛡️ Recovery: Files backed up in $backup_dir"
        fi
    else
        log_info "Git clean cancelled"
    fi
}

# Safe Branch Delete - Checks for unmerged commits
safe-branch-delete() {
    local branch_name="$1"
    
    if [[ -z "$branch_name" ]]; then
        log_error "Branch name required"
        echo "Usage: safe-branch-delete <branch-name>"
        return 1
    fi
    
    echo -e "${PURPLE}🔀 Safe Branch Delete${NC}"
    echo "Branch: $branch_name"
    echo
    
    # Check if branch exists
    if ! git show-ref --verify --quiet refs/heads/"$branch_name"; then
        log_error "Branch '$branch_name' does not exist"
        return 1
    fi
    
    # Check for unmerged commits
    local unmerged_commits=$(git log --oneline main.."$branch_name" 2>/dev/null | wc -l)
    if [[ $unmerged_commits -gt 0 ]]; then
        echo -e "${YELLOW}⚠️ Branch has $unmerged_commits unmerged commits:${NC}"
        git log --oneline main.."$branch_name"
        echo
        
        # Create backup tag
        local backup_tag="backup-branch-$branch_name-$(date +%Y%m%d-%H%M%S)"
        git tag "$backup_tag" "$branch_name"
        log_info "Created backup tag: $backup_tag"
        echo "🛡️ Recovery: git checkout -b $branch_name $backup_tag"
        echo
    fi
    
    # Show branch info
    echo -e "${CYAN}📊 Branch information:${NC}"
    git log --oneline "$branch_name" -5
    echo
    
    # Confirm deletion
    read -p "Delete branch '$branch_name'? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        git branch -d "$branch_name" || git branch -D "$branch_name"
        log_success "Branch deleted safely"
    else
        log_info "Branch deletion cancelled"
    fi
}

# Safe File Operations
safe-rm() {
    local files=("$@")
    
    if [[ ${#files[@]} -eq 0 ]]; then
        log_error "No files specified"
        echo "Usage: safe-rm <file1> [file2] ..."
        return 1
    fi
    
    echo -e "${PURPLE}🗑️ Safe File Removal${NC}"
    echo "Files to remove: ${files[*]}"
    echo
    
    # Create backup directory
    local backup_dir=".safe-rm-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Check each file
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            # Copy to backup
            local dir_path=$(dirname "$file")
            mkdir -p "$backup_dir/$dir_path"
            cp "$file" "$backup_dir/$file"
            log_info "Backed up: $file"
        elif [[ -d "$file" ]]; then
            # Copy directory to backup
            cp -r "$file" "$backup_dir/"
            log_info "Backed up directory: $file"
        else
            log_warning "File not found: $file"
        fi
    done
    
    echo
    read -p "Proceed with removal? Files are backed up in $backup_dir (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        rm -rf "${files[@]}"
        log_success "Files removed safely"
        echo "🛡️ Recovery: Files backed up in $backup_dir"
    else
        log_info "File removal cancelled"
        rm -rf "$backup_dir"
    fi
}

# VERIFICATION AND ANALYSIS COMMANDS

# Quick safety check for any operation
verify-safety() {
    local operation="$1"
    
    if [[ -z "$operation" ]]; then
        log_error "Operation required"
        echo "Usage: verify-safety 'git reset --hard'"
        return 1
    fi
    
    if [[ -x "$DESTRUCTIVE_GUARD" ]]; then
        python3 "$DESTRUCTIVE_GUARD" verify-safety "$operation"
    else
        log_error "Destructive operation guard not available"
        return 1
    fi
}

# Quick recovery interface
recover-data() {
    local mode="${1:-interactive}"
    
    echo -e "${PURPLE}🛡️ Data Recovery Assistant${NC}"
    echo
    
    if [[ -x "$RECOVERY_ASSISTANT" ]]; then
        case "$mode" in
            "auto"|"automatic")
                python3 "$RECOVERY_ASSISTANT" recover --auto
                ;;
            "list"|"show")
                python3 "$RECOVERY_ASSISTANT" list-recovery-points
                ;;
            "detect")
                python3 "$RECOVERY_ASSISTANT" detect
                ;;
            "emergency")
                python3 "$RECOVERY_ASSISTANT" emergency
                ;;
            *)
                python3 "$RECOVERY_ASSISTANT" recover --interactive
                ;;
        esac
    else
        log_error "Recovery assistant not available"
        return 1
    fi
}

# Show current workspace safety status
safety-status() {
    echo -e "${PURPLE}🛡️ Workspace Safety Status${NC}"
    echo
    
    # Git status
    echo -e "${CYAN}📊 Git Status:${NC}"
    if git status --porcelain | grep -q .; then
        echo -e "${YELLOW}⚠️ Uncommitted changes detected${NC}"
        git status --porcelain | head -10
    else
        echo -e "${GREEN}✅ Working directory clean${NC}"
    fi
    echo
    
    # Stash list
    echo -e "${CYAN}💾 Available Stashes:${NC}"
    local stash_count=$(git stash list | wc -l)
    if [[ $stash_count -gt 0 ]]; then
        echo -e "${GREEN}✅ $stash_count stashes available${NC}"
        git stash list | head -5
    else
        echo -e "${YELLOW}⚠️ No stashes available${NC}"
    fi
    echo
    
    # Recent commits
    echo -e "${CYAN}📝 Recent Commits:${NC}"
    git log --oneline -5
    echo
    
    # Backup directories
    echo -e "${CYAN}🗂️ Available Backups:${NC}"
    local backup_count=0
    for backup_dir in .destructive-guard-backups .git-clean-backup-* .safe-rm-backup-* backup-*; do
        if [[ -d "$backup_dir" ]]; then
            echo "  📁 $backup_dir"
            ((backup_count++))
        fi
    done
    
    if [[ $backup_count -eq 0 ]]; then
        echo -e "${YELLOW}⚠️ No backup directories found${NC}"
    else
        echo -e "${GREEN}✅ $backup_count backup directories available${NC}"
    fi
}

# EMERGENCY AND GUIDANCE COMMANDS

# Emergency stop - prevents any destructive operations
emergency-stop() {
    echo -e "${RED}🚨 EMERGENCY STOP ACTIVATED${NC}"
    echo
    echo "Creating emergency backup..."
    
    # Create emergency stash
    local emergency_stash="emergency-stop-$(date +%Y%m%d-%H%M%S)"
    git add . 2>/dev/null || true
    git stash push -m "$emergency_stash" --include-untracked 2>/dev/null || true
    
    # Create emergency branch
    local emergency_branch="emergency-backup-$(date +%Y%m%d-%H%M%S)"
    git branch "$emergency_branch" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Emergency backups created:${NC}"
    echo "  🏷️ Stash: $emergency_stash"
    echo "  🌿 Branch: $emergency_branch"
    echo
    echo -e "${YELLOW}📋 SAFETY PROTOCOL:${NC}"
    echo "1. STOP all destructive operations immediately"
    echo "2. Assess the situation with: safety-status"
    echo "3. Check for data loss with: recover-data detect"
    echo "4. Use recovery tools if needed: recover-data"
    echo "5. Only proceed when you understand the risks"
}

# Show safer alternatives for dangerous commands
show-alternatives() {
    local dangerous_cmd="$1"
    
    echo -e "${PURPLE}💡 Safer Alternatives${NC}"
    echo
    
    case "$dangerous_cmd" in
        *"reset --hard"*)
            echo -e "${CYAN}Instead of 'git reset --hard':${NC}"
            echo "  ✅ safe-reset                    # Protected reset with backups"
            echo "  ✅ git stash && git reset        # Save changes first"
            echo "  ✅ git checkout -- <files>       # Reset specific files only"
            ;;
        *"clean -fd"*|*"clean -f"*)
            echo -e "${CYAN}Instead of 'git clean -fd':${NC}"
            echo "  ✅ protected-clean                # Protected clean with backup"
            echo "  ✅ git clean -n -fd              # Dry run first"
            echo "  ✅ git stash -u && git clean     # Save untracked files first"
            ;;
        *"rm -rf"*)
            echo -e "${CYAN}Instead of 'rm -rf':${NC}"
            echo "  ✅ safe-rm                       # Protected removal with backup"
            echo "  ✅ mv folder folder.backup       # Rename instead of delete"
            echo "  ✅ git rm --cached               # Remove from git only"
            ;;
        *"branch -D"*|*"branch -d"*)
            echo -e "${CYAN}Instead of 'git branch -D':${NC}"
            echo "  ✅ safe-branch-delete            # Protected branch deletion"
            echo "  ✅ git tag backup-branch branch  # Tag before delete"
            echo "  ✅ git archive branch > backup   # Archive branch first"
            ;;
        *)
            echo "Command not recognized. General safety tips:"
            echo "  💡 Use verify-safety 'command' to check safety"
            echo "  💡 Create backups before destructive operations"
            echo "  💡 Use git stash to save uncommitted work"
            echo "  💡 Test commands with -n (dry run) flags when available"
            ;;
    esac
}

# OVERRIDE PROTECTION - Replace dangerous commands with safe versions

# Function to set up command overrides
setup-protection-overrides() {
    echo -e "${PURPLE}🛡️ Setting up Protection Overrides${NC}"
    echo "This will replace dangerous commands with safe alternatives in your current shell."
    echo
    
    read -p "Enable protection overrides? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Protection overrides not enabled"
        return 0
    fi
    
    # Git command overrides
    alias git-reset-hard='echo "⚠️ BLOCKED: Use safe-reset instead" && show-alternatives "reset --hard"'
    alias git-clean-fd='echo "⚠️ BLOCKED: Use protected-clean instead" && show-alternatives "clean -fd"'
    
    # Create wrapper function for git
    git() {
        local cmd="$1"
        shift
        
        case "$cmd" in
            "reset")
                if [[ "$1" == "--hard" ]]; then
                    echo -e "${RED}⚠️ DESTRUCTIVE OPERATION BLOCKED${NC}"
                    echo "Use 'safe-reset' instead for protected reset with backups"
                    show-alternatives "reset --hard"
                    return 1
                fi
                ;;
            "clean")
                if [[ "$*" == *"-fd"* ]] || [[ "$*" == *"-f"* ]]; then
                    echo -e "${RED}⚠️ DESTRUCTIVE OPERATION BLOCKED${NC}"
                    echo "Use 'protected-clean' instead for safe cleaning with backups"
                    show-alternatives "clean -fd"
                    return 1
                fi
                ;;
            "branch")
                if [[ "$1" == "-D" ]]; then
                    echo -e "${RED}⚠️ DESTRUCTIVE OPERATION BLOCKED${NC}"
                    echo "Use 'safe-branch-delete' instead for protected branch deletion"
                    show-alternatives "branch -D"
                    return 1
                fi
                ;;
        esac
        
        # Execute original git command
        command git "$cmd" "$@"
    }
    
    # File system overrides
    alias rm='echo "⚠️ CONSIDER: Use safe-rm for protected removal with backups"'
    
    log_success "Protection overrides enabled for current shell session"
    echo "🛡️ Protected commands: git reset --hard, git clean -fd, git branch -D, rm"
    echo "📚 Use 'disable-protection-overrides' to disable"
}

# Disable protection overrides
disable-protection-overrides() {
    unalias git-reset-hard 2>/dev/null || true
    unalias git-clean-fd 2>/dev/null || true
    unalias rm 2>/dev/null || true
    unset -f git 2>/dev/null || true
    
    log_info "Protection overrides disabled"
}

# EDUCATIONAL AND HELP COMMANDS

# Show help for all safety commands
safety-help() {
    echo -e "${PURPLE}🛡️ Safety Command Help${NC}"
    echo
    echo -e "${CYAN}🔒 Safe Operation Commands:${NC}"
    echo "  safe-reset [target]              # Protected git reset with backups"
    echo "  protected-clean [flags]          # Protected git clean with backups"
    echo "  safe-branch-delete <branch>      # Protected branch deletion with backups"
    echo "  safe-rm <files...>               # Protected file removal with backups"
    echo
    echo -e "${CYAN}🔍 Analysis Commands:${NC}"
    echo "  verify-safety 'command'          # Check operation safety before execution"
    echo "  safety-status                    # Show current workspace safety status"
    echo "  show-alternatives 'command'      # Show safer alternatives for dangerous commands"
    echo
    echo -e "${CYAN}🛡️ Recovery Commands:${NC}"
    echo "  recover-data [mode]              # Interactive data recovery (auto/list/detect/emergency)"
    echo "  emergency-stop                   # Create emergency backups and stop operations"
    echo
    echo -e "${CYAN}⚙️ Protection Setup:${NC}"
    echo "  setup-protection-overrides       # Enable command overrides for safety"
    echo "  disable-protection-overrides     # Disable command overrides"
    echo
    echo -e "${CYAN}📚 Learning Commands:${NC}"
    echo "  safety-help                      # Show this help"
    echo "  show-alternatives 'command'      # Learn safer ways to do dangerous operations"
    echo
    echo -e "${YELLOW}💡 Usage Tips:${NC}"
    echo "  • Always run 'verify-safety' before dangerous operations"
    echo "  • Use 'safety-status' to understand your workspace state"
    echo "  • Create backups with safe-* commands before risky operations"
    echo "  • Use 'recover-data' immediately if you lose work"
    echo "  • Enable protection overrides for automatic safety"
}

# Show reasoning enforcement tips
reasoning-tips() {
    echo -e "${PURPLE}🧠 Reasoning Enforcement Tips${NC}"
    echo
    echo -e "${CYAN}✅ Good Problem-Solving Approach:${NC}"
    echo "  1. Understand the ROOT CAUSE of the issue"
    echo "  2. Research PROPER SOLUTIONS, not workarounds"
    echo "  3. Fix the underlying problem, don't bypass quality gates"
    echo "  4. Test your solution thoroughly"
    echo "  5. Commit clean, working code"
    echo
    echo -e "${CYAN}❌ Avoid These Patterns:${NC}"
    echo "  • git commit --no-verify         # Bypasses quality checks"
    echo "  • eslint-disable                 # Ignores code quality rules"
    echo "  • @ts-ignore                     # Suppresses type safety"
    echo "  • .skip() or .only() in tests    # Avoids fixing failing tests"
    echo "  • Lowering coverage thresholds   # Reduces code quality standards"
    echo
    echo -e "${CYAN}🎯 Instead, Try:${NC}"
    echo "  • Fix the failing pre-commit checks"
    echo "  • Improve code to meet ESLint standards"
    echo "  • Properly type your TypeScript code"
    echo "  • Make all tests pass by fixing the issues"
    echo "  • Write more tests to meet coverage requirements"
    echo
    echo "🧠 Remember: Quality gates exist to help you write better code!"
}

# Initialization message
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being run directly
    echo -e "${PURPLE}🛡️ Verification Aliases Script${NC}"
    echo "This script should be sourced, not executed directly."
    echo "Usage: source ${BASH_SOURCE[0]}"
    exit 1
else
    # Script is being sourced
    echo -e "${GREEN}✅ Safety aliases loaded${NC}"
    echo "Run 'safety-help' for available commands"
    echo "Run 'setup-protection-overrides' to enable automatic protection"
fi