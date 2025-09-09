#!/bin/bash
# Install Verification System - Complete reasoning enforcement setup

set -euo pipefail

echo "🛡️ Installing Comprehensive Reasoning Enforcement System..."

# Function to check if command succeeded
check_success() {
    if [ $? -eq 0 ]; then
        echo "✅ $1"
    else
        echo "❌ Failed: $1"
        exit 1
    fi
}

# Create directories if they don't exist
echo "📁 Creating directory structure..."
mkdir -p ~/.claude/hooks
mkdir -p ~/.bashrc.d
check_success "Directory structure created"

# Install Claude Code hooks
echo "🪝 Installing Claude Code hooks..."

# Copy reasoning validation hook
if [ -f ".claude/hooks/reasoning-validator.py" ]; then
    cp ".claude/hooks/reasoning-validator.py" ~/.claude/hooks/
    chmod +x ~/.claude/hooks/reasoning-validator.py
    check_success "Reasoning validation hook installed"
fi

# Copy session recovery hook
if [ -f ".claude/hooks/session-stats-recovery.py" ]; then
    cp ".claude/hooks/session-stats-recovery.py" ~/.claude/hooks/
    chmod +x ~/.claude/hooks/session-stats-recovery.py
    check_success "Session recovery hook installed"
fi

# Copy state capture hook
if [ -f ".claude/hooks/pre-compact-state-capture.py" ]; then
    cp ".claude/hooks/pre-compact-state-capture.py" ~/.claude/hooks/
    chmod +x ~/.claude/hooks/pre-compact-state-capture.py
    check_success "State capture hook installed"
fi

# Install verification aliases system
echo "🔧 Installing verification aliases..."
if [ -f ".claude/aliases/verification-aliases.sh" ]; then
    cp ".claude/aliases/verification-aliases.sh" ~/.bashrc.d/
    chmod +x ~/.bashrc.d/verification-aliases.sh
    check_success "Verification aliases installed"
fi

# Add to bashrc if not already there
if ! grep -q "verification-aliases.sh" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# Load verification aliases to prevent shortcuts" >> ~/.bashrc
    echo "if [ -f ~/.bashrc.d/verification-aliases.sh ]; then" >> ~/.bashrc
    echo "    source ~/.bashrc.d/verification-aliases.sh" >> ~/.bashrc
    echo "fi" >> ~/.bashrc
    check_success "Bashrc updated with verification aliases"
fi

# Install git pre-commit hook if it exists
echo "📝 Installing git pre-commit hook..."
if [ -f ".git/hooks/pre-commit" ] && [ -x ".git/hooks/pre-commit" ]; then
    echo "✅ Git pre-commit hook already installed and executable"
else
    echo "⚠️  Git pre-commit hook not found or not executable"
fi

# Create enforcement verification script
echo "🔍 Creating enforcement verification script..."
cat > ~/.claude/scripts/verify-enforcement.sh << 'EOF'
#!/bin/bash
# Verify Reasoning Enforcement System

echo "🔍 Verifying Reasoning Enforcement System..."

# Check Claude Code hooks
hooks_ok=true
for hook in reasoning-validator.py session-stats-recovery.py pre-compact-state-capture.py; do
    if [ -f ~/.claude/hooks/$hook ] && [ -x ~/.claude/hooks/$hook ]; then
        echo "✅ $hook installed and executable"
    else
        echo "❌ $hook missing or not executable"
        hooks_ok=false
    fi
done

# Check verification aliases
if [ -f ~/.bashrc.d/verification-aliases.sh ]; then
    echo "✅ Verification aliases installed"
else
    echo "❌ Verification aliases missing"
    hooks_ok=false
fi

# Check bashrc integration
if grep -q "verification-aliases.sh" ~/.bashrc 2>/dev/null; then
    echo "✅ Bashrc integration configured"
else
    echo "❌ Bashrc integration missing"
    hooks_ok=false
fi

# Test a few key aliases
source ~/.bashrc.d/verification-aliases.sh 2>/dev/null || true
if command -v git-no-verify &> /dev/null; then
    echo "✅ Verification aliases loaded successfully"
else
    echo "❌ Verification aliases not loading properly"
    hooks_ok=false
fi

if [ "$hooks_ok" = true ]; then
    echo "✅ All enforcement systems verified and working"
    exit 0
else
    echo "❌ Some enforcement systems need attention"
    exit 1
fi
EOF

mkdir -p ~/.claude/scripts
chmod +x ~/.claude/scripts/verify-enforcement.sh
check_success "Enforcement verification script created"

# Create uninstall script for testing
echo "🗑️ Creating uninstall script..."
cat > ~/.claude/scripts/uninstall-enforcement.sh << 'EOF'
#!/bin/bash
# Uninstall Reasoning Enforcement System (for testing)

echo "🗑️ Uninstalling Reasoning Enforcement System..."

# Remove Claude Code hooks
rm -f ~/.claude/hooks/reasoning-validator.py
rm -f ~/.claude/hooks/session-stats-recovery.py  
rm -f ~/.claude/hooks/pre-compact-state-capture.py

# Remove verification aliases
rm -f ~/.bashrc.d/verification-aliases.sh

# Remove bashrc integration
if [ -f ~/.bashrc ]; then
    grep -v "verification-aliases.sh" ~/.bashrc > ~/.bashrc.tmp
    mv ~/.bashrc.tmp ~/.bashrc
fi

echo "✅ Enforcement system uninstalled"
EOF

chmod +x ~/.claude/scripts/uninstall-enforcement.sh
check_success "Uninstall script created"

echo ""
echo "🎉 Reasoning Enforcement System Installation Complete!"
echo ""
echo "📋 What was installed:"
echo "  • Claude Code hooks for real-time reasoning validation"
echo "  • Session recovery with reasoning checkpoints"
echo "  • State capture before compaction events"
echo "  • Verification aliases that redirect shortcuts to proper solutions"
echo "  • Automatic loading via ~/.bashrc"
echo ""
echo "🔍 Test the installation:"
echo "  ~/.claude/scripts/verify-enforcement.sh"
echo ""
echo "🛡️ Try a bypass command (should show proper guidance):"
echo "  git-no-verify"
echo "  eslint-disable"
echo "  ts-ignore"
echo ""
echo "✅ Use proper solution commands:"
echo "  proper-git"
echo "  proper-eslint"
echo "  root-cause"
echo "  verify-quality"
echo ""
echo "🔄 Restart your terminal or run: source ~/.bashrc"