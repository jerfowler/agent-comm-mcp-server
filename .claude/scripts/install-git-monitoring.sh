#!/bin/bash
# Install Git Command Monitoring for Reasoning Detection

set -euo pipefail

echo "🔍 Installing Git Command Monitoring..."

# Create git hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create or update pre-command hook (if supported)
# This will integrate with the existing pre-commit hook
echo "📝 Integrating with existing pre-commit hook..."

# Check if we can modify the existing pre-commit hook
if [ -f ".git/hooks/pre-commit" ]; then
    # Add reasoning monitoring to existing pre-commit hook
    if ! grep -q "reasoning-monitor.sh" .git/hooks/pre-commit; then
        # Create backup
        cp .git/hooks/pre-commit .git/hooks/pre-commit.backup
        
        # Add monitoring call to the beginning of pre-commit hook
        cat > .git/hooks/pre-commit.new << 'EOF'
#!/bin/bash
# Enhanced Pre-commit Hook with Reasoning Pattern Monitoring

# Start reasoning monitoring for this commit
CLAUDE_SCRIPTS_DIR=".claude/scripts"
if [ -f "$CLAUDE_SCRIPTS_DIR/reasoning-monitor.sh" ]; then
    "$CLAUDE_SCRIPTS_DIR/reasoning-monitor.sh" start-session "commit-$(date +%H%M%S)" 2>/dev/null || true
fi

EOF
        
        # Append original pre-commit content (skip shebang if present)
        tail -n +2 .git/hooks/pre-commit >> .git/hooks/pre-commit.new 2>/dev/null || cat .git/hooks/pre-commit >> .git/hooks/pre-commit.new
        
        mv .git/hooks/pre-commit.new .git/hooks/pre-commit
        chmod +x .git/hooks/pre-commit
        
        echo "✅ Pre-commit hook enhanced with reasoning monitoring"
    else
        echo "✅ Pre-commit hook already includes reasoning monitoring"
    fi
fi

# Create post-command monitoring via shell function wrapper
echo "🔧 Creating shell function wrappers..."

cat > ~/.claude/scripts/git-wrapper.sh << 'EOF'
#!/bin/bash
# Git Wrapper with Reasoning Pattern Detection

# Original git command
ORIGINAL_GIT=$(which git)

# Our monitoring-enabled git function
git() {
    local git_command="git $*"
    local claude_monitor=".claude/scripts/reasoning-monitor.sh"
    
    # Log the command attempt
    if [ -f "$claude_monitor" ]; then
        "$claude_monitor" monitor-git "$git_command" 2>/dev/null || true
    fi
    
    # Execute the actual git command
    "$ORIGINAL_GIT" "$@"
    
    # Post-command analysis
    local exit_code=$?
    if [ $exit_code -ne 0 ] && [ -f "$claude_monitor" ]; then
        "$claude_monitor" analyze "Failed: $git_command" 2>/dev/null || true
    fi
    
    return $exit_code
}

# Export the function
export -f git
EOF

chmod +x ~/.claude/scripts/git-wrapper.sh

# Add wrapper to bashrc if not already there
if ! grep -q "git-wrapper.sh" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Load git monitoring wrapper" >> ~/.bashrc
    echo "if [ -f ~/.claude/scripts/git-wrapper.sh ]; then" >> ~/.bashrc
    echo "    source ~/.claude/scripts/git-wrapper.sh" >> ~/.bashrc
    echo "fi" >> ~/.bashrc
    echo "✅ Git wrapper added to ~/.bashrc"
fi

# Create command-line monitoring aliases
echo "🛠️ Creating monitoring command aliases..."

cat > ~/.claude/scripts/monitoring-commands.sh << 'EOF'
#!/bin/bash
# Monitoring Command Aliases

# Quick reasoning check
check-reasoning() {
    local claude_monitor=".claude/scripts/reasoning-monitor.sh"
    if [ -f "$claude_monitor" ]; then
        "$claude_monitor" summary
    else
        echo "❌ Reasoning monitor not found"
    fi
}

# Monitor any command for reasoning patterns
monitor-command() {
    local command="$*"
    local claude_monitor=".claude/scripts/reasoning-monitor.sh"
    
    echo "🔍 Monitoring command: $command"
    
    if [ -f "$claude_monitor" ]; then
        "$claude_monitor" analyze "$command"
    fi
    
    # Execute the command
    eval "$command"
}

# Start a new reasoning session
start-reasoning-session() {
    local session_id="${1:-$(date +%Y%m%d_%H%M%S)}"
    local claude_monitor=".claude/scripts/reasoning-monitor.sh"
    
    if [ -f "$claude_monitor" ]; then
        "$claude_monitor" start-session "$session_id"
    else
        echo "❌ Reasoning monitor not found"
    fi
}

# Show reasoning intervention
reasoning-help() {
    local claude_monitor=".claude/scripts/reasoning-monitor.sh"
    if [ -f "$claude_monitor" ]; then
        "$claude_monitor" intervention
    else
        echo "❌ Reasoning monitor not found"
    fi
}

export -f check-reasoning monitor-command start-reasoning-session reasoning-help

echo "🧠 Monitoring commands loaded: check-reasoning, monitor-command, start-reasoning-session, reasoning-help"
EOF

chmod +x ~/.claude/scripts/monitoring-commands.sh

# Add monitoring commands to bashrc
if ! grep -q "monitoring-commands.sh" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Load reasoning monitoring commands" >> ~/.bashrc  
    echo "if [ -f ~/.claude/scripts/monitoring-commands.sh ]; then" >> ~/.bashrc
    echo "    source ~/.claude/scripts/monitoring-commands.sh" >> ~/.bashrc
    echo "fi" >> ~/.bashrc
    echo "✅ Monitoring commands added to ~/.bashrc"
fi

# Test the installation
echo "🧪 Testing reasoning monitoring installation..."

# Test the monitor script
if .claude/scripts/reasoning-monitor.sh help >/dev/null 2>&1; then
    echo "✅ Reasoning monitor script functional"
else
    echo "❌ Reasoning monitor script has issues"
fi

# Create initial session
.claude/scripts/reasoning-monitor.sh start-session "installation-test" || true

# Test pattern detection
echo "🔍 Testing pattern detection..."
.claude/scripts/reasoning-monitor.sh analyze "git commit --no-verify -m 'skip validation'" || true
.claude/scripts/reasoning-monitor.sh analyze "npm run ci && proper solution" || true

echo ""
echo "🎉 Git Command Monitoring Installation Complete!"
echo ""
echo "📋 What was installed:"
echo "  • Git command monitoring wrapper"
echo "  • Pre-commit hook integration"  
echo "  • Reasoning pattern detection"
echo "  • Real-time bypass alerts"
echo "  • Session statistics tracking"
echo ""
echo "🧠 Available commands:"
echo "  check-reasoning        - Show current session stats"
echo "  monitor-command <cmd>  - Monitor any command execution"
echo "  start-reasoning-session - Begin new monitoring session"
echo "  reasoning-help         - Show reasoning intervention"
echo ""
echo "🔄 Restart your terminal or run: source ~/.bashrc"
echo "📊 Check status: .claude/scripts/reasoning-monitor.sh summary"