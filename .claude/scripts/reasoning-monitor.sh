#!/bin/bash
# Real-time Reasoning Pattern Detection System
# Monitors git commands, file modifications, and command patterns for bypass attempts

set -euo pipefail

# Configuration
MONITOR_LOG_FILE="${HOME}/.claude/logs/reasoning-monitor.log"
PATTERN_DETECTION_DB="${HOME}/.claude/data/pattern-detection.json"
ALERT_THRESHOLD=3
SESSION_ID=$(date +%Y%m%d_%H%M%S)

# Create necessary directories
mkdir -p "$(dirname "$MONITOR_LOG_FILE")"
mkdir -p "$(dirname "$PATTERN_DETECTION_DB")"

# Initialize pattern database if it doesn't exist
if [ ! -f "$PATTERN_DETECTION_DB" ]; then
    cat > "$PATTERN_DETECTION_DB" << 'EOF'
{
  "sessions": {},
  "global_stats": {
    "total_bypass_attempts": 0,
    "total_proper_solutions": 0,
    "current_reasoning_score": 0.5,
    "last_updated": ""
  }
}
EOF
fi

log_event() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$MONITOR_LOG_FILE"
    
    # Also output to stderr for immediate visibility
    if [ "$level" = "ALERT" ] || [ "$level" = "WARNING" ]; then
        echo "🚨 [$level] $message" >&2
    fi
}

analyze_command() {
    local command="$1"
    local bypass_patterns=(
        "git.*--no-verify"
        "git.*-n\s"
        "eslint-disable"
        "@ts-ignore" 
        "\.skip\("
        "\.only\("
        "threshold.*down"
        "lower.*threshold"
        "disable.*coverage"
        "workaround"
        "quick.*fix"
        "temporary.*disable"
        "for now.*skip"
        "bypass.*for"
    )
    
    local proper_patterns=(
        "npm run ci"
        "npm run lint"
        "npm run type-check"
        "npm test"
        "root cause"
        "fix.*properly"
        "analyze.*issue"
        "proper.*solution"
    )
    
    local bypass_score=0
    local proper_score=0
    
    # Check for bypass patterns
    for pattern in "${bypass_patterns[@]}"; do
        if echo "$command" | grep -qiE "$pattern"; then
            bypass_score=$((bypass_score + 1))
            log_event "WARNING" "Bypass pattern detected: $pattern in command: $command"
        fi
    done
    
    # Check for proper patterns
    for pattern in "${proper_patterns[@]}"; do
        if echo "$command" | grep -qiE "$pattern"; then
            proper_score=$((proper_score + 1))
            log_event "INFO" "Proper reasoning pattern detected: $pattern"
        fi
    done
    
    # Calculate reasoning score for this command
    local total_score=$((bypass_score + proper_score))
    local command_reasoning_score=0.5
    
    if [ $total_score -gt 0 ]; then
        command_reasoning_score=$(echo "scale=2; $proper_score / $total_score" | bc -l 2>/dev/null || echo "0.5")
    fi
    
    # Alert if bypass attempts exceed threshold
    if [ $bypass_score -ge $ALERT_THRESHOLD ]; then
        log_event "ALERT" "HIGH BYPASS RISK: $bypass_score bypass patterns in single command!"
        show_reasoning_intervention
    fi
    
    # Update statistics
    update_session_stats "$bypass_score" "$proper_score" "$command_reasoning_score"
}

show_reasoning_intervention() {
    cat >&2 << 'EOF'

🚨 REASONING INTERVENTION TRIGGERED 🚨

❌ MULTIPLE BYPASS PATTERNS DETECTED
✅ MANDATORY REASONING CHECKPOINT:

🧠 STOP AND THINK:
1. What is the ROOT CAUSE of the current issue?
2. WHY am I trying to bypass quality controls?
3. How can I FIX THE ACTUAL PROBLEM?
4. Will my approach MEET ALL STANDARDS?

🛡️ PROPER APPROACH:
- Use 'root-cause' command for analysis
- Use 'proper-eslint' for code quality
- Use 'verify-quality' for validation
- Focus on FIXING, not BYPASSING

⚠️  REMEMBER: Quality gates exist to help, not hinder
EOF
}

update_session_stats() {
    local bypass_count="$1"
    local proper_count="$2" 
    local reasoning_score="$3"
    local timestamp=$(date -Iseconds)
    
    # Use jq to update the JSON database
    if command -v jq >/dev/null 2>&1; then
        local temp_file=$(mktemp)
        jq --arg session "$SESSION_ID" \
           --arg timestamp "$timestamp" \
           --argjson bypass "$bypass_count" \
           --argjson proper "$proper_count" \
           --argjson score "$reasoning_score" \
           '
           .sessions[$session] += {
               "bypass_attempts": ((.sessions[$session].bypass_attempts // 0) + $bypass),
               "proper_solutions": ((.sessions[$session].proper_solutions // 0) + $proper),
               "last_activity": $timestamp,
               "reasoning_score": $score
           } |
           .global_stats.total_bypass_attempts += $bypass |
           .global_stats.total_proper_solutions += $proper |
           .global_stats.last_updated = $timestamp |
           .global_stats.current_reasoning_score = (
               if (.global_stats.total_bypass_attempts + .global_stats.total_proper_solutions) > 0 
               then (.global_stats.total_proper_solutions / (.global_stats.total_bypass_attempts + .global_stats.total_proper_solutions))
               else 0.5 
               end
           )
           ' "$PATTERN_DETECTION_DB" > "$temp_file" && mv "$temp_file" "$PATTERN_DETECTION_DB"
    fi
}

monitor_git_commands() {
    # Monitor git command execution
    local git_command="$1"
    
    log_event "INFO" "Git command executed: $git_command"
    analyze_command "$git_command"
    
    # Special handling for commit bypass attempts
    if echo "$git_command" | grep -qE "(--no-verify|-n\s)"; then
        log_event "ALERT" "GIT BYPASS DETECTED: $git_command"
        cat >&2 << 'EOF'

🚫 GIT BYPASS DETECTED!

❌ REASONING VIOLATION: Why bypass pre-commit validation?
✅ PROPER APPROACH: Fix the issues that pre-commit detected

REQUIRED ACTIONS:
1. git reset --soft HEAD~1  (undo bypass commit)
2. npm run ci               (verify all quality gates)
3. Fix any reported issues
4. git commit               (proper commit without bypass)

🧠 REMEMBER: Pre-commit hooks protect code quality
EOF
    fi
}

show_session_summary() {
    if [ -f "$PATTERN_DETECTION_DB" ] && command -v jq >/dev/null 2>&1; then
        local session_data=$(jq -r --arg session "$SESSION_ID" '.sessions[$session] // {}' "$PATTERN_DETECTION_DB")
        local global_data=$(jq -r '.global_stats' "$PATTERN_DETECTION_DB")
        
        echo "📊 REASONING PATTERN SUMMARY - Session $SESSION_ID" >&2
        echo "Current session:" >&2
        echo "$session_data" | jq -r '
        if . == {} then 
            "  No pattern data recorded"
        else
            "  Bypass attempts: \(.bypass_attempts // 0)\n  Proper solutions: \(.proper_solutions // 0)\n  Reasoning score: \(.reasoning_score // 0.5)"
        end' >&2
        
        echo "Global statistics:" >&2
        echo "$global_data" | jq -r '"  Total bypass attempts: \(.total_bypass_attempts)\n  Total proper solutions: \(.total_proper_solutions)\n  Overall reasoning score: \(.current_reasoning_score)"' >&2
    fi
}

# Command-line interface
case "${1:-help}" in
    "monitor-git")
        monitor_git_commands "${2:-}"
        ;;
    "analyze")
        analyze_command "${2:-}"
        ;;
    "summary")
        show_session_summary
        ;;
    "start-session")
        SESSION_ID="${2:-$(date +%Y%m%d_%H%M%S)}"
        log_event "INFO" "Starting reasoning monitoring session: $SESSION_ID"
        echo "🧠 Reasoning pattern detection active - Session: $SESSION_ID" >&2
        ;;
    "intervention")
        show_reasoning_intervention
        ;;
    "help"|*)
        cat << 'EOF'
Real-time Reasoning Pattern Detection System

Usage:
  ./reasoning-monitor.sh monitor-git "git commit --no-verify"
  ./reasoning-monitor.sh analyze "eslint-disable next-line"  
  ./reasoning-monitor.sh summary
  ./reasoning-monitor.sh start-session [session-id]
  ./reasoning-monitor.sh intervention

Functions:
  monitor-git    - Monitor git command execution
  analyze        - Analyze any command for reasoning patterns
  summary        - Show session and global statistics
  start-session  - Initialize new monitoring session
  intervention   - Display reasoning intervention message

Bypass patterns detected:
  - git --no-verify, eslint-disable, @ts-ignore
  - skip-test, lower-threshold, quick-fix
  - workaround, temporary-disable

Proper patterns recognized:
  - npm run ci/lint/test, root-cause analysis
  - fix-properly, proper-solution approaches

Logs: ~/.claude/logs/reasoning-monitor.log  
Data: ~/.claude/data/pattern-detection.json
EOF
        ;;
esac