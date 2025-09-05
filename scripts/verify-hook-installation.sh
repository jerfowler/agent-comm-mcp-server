#!/bin/bash

# TodoWrite Hook Installation Verification Script
# This script validates that the sync-todos-to-checkboxes.py hook is properly installed

set -e

echo "🔍 TodoWrite Hook Installation Verification"
echo "==========================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HOOK_FILE="$HOME/.claude/hooks/sync-todos-to-checkboxes.py"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"
    
    echo -n "Testing: $test_name... "
    
    if output=$(eval "$test_command" 2>&1); then
        actual_exit_code=0
    else
        actual_exit_code=$?
    fi
    
    if [ "$actual_exit_code" -eq "$expected_exit_code" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        if [ -n "$output" ] && [ "$4" = "verbose" ]; then
            echo "   Output: $output"
        fi
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "   Expected exit code: $expected_exit_code, got: $actual_exit_code"
        echo "   Output: $output"
        ((TESTS_FAILED++))
    fi
}

# Header
echo -e "${BLUE}Step 1: Basic Environment Check${NC}"
echo "--------------------------------"

# Check if Python is available (try both python and python3)
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
    run_test "Python3 availability" "which python3"
    run_test "Python3 version check" "python3 --version"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
    run_test "Python availability" "which python"
    run_test "Python version check" "python --version"
else
    echo -e "${RED}❌ Neither python nor python3 found in PATH${NC}"
    ((TESTS_FAILED++))
    exit 1
fi

echo

# Check Claude Code hooks directory
echo -e "${BLUE}Step 2: Claude Code Hooks Directory${NC}"
echo "------------------------------------"

if [ ! -d "$HOME/.claude" ]; then
    echo -e "${YELLOW}⚠️  Warning: ~/.claude directory doesn't exist${NC}"
    echo "   This is normal if you haven't used Claude Code yet"
fi

if [ ! -d "$HOME/.claude/hooks" ]; then
    echo -e "${YELLOW}⚠️  Warning: ~/.claude/hooks directory doesn't exist${NC}"
    echo "   You may need to create it: mkdir -p ~/.claude/hooks"
fi

echo

# Check hook file installation
echo -e "${BLUE}Step 3: Hook File Installation${NC}"
echo "-------------------------------"

if [ ! -f "$HOOK_FILE" ]; then
    echo -e "${RED}❌ Hook file not found at: $HOOK_FILE${NC}"
    echo
    echo "Installation instructions:"
    echo "1. Find your installation:"
    echo "   - Global: find /usr/local/lib/node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/ -name '*.py'"
    echo "   - Local: find ./node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/ -name '*.py'"
    echo "   - Source: ls $PROJECT_ROOT/.claude/hooks/sync-todos-to-checkboxes.py"
    echo
    echo "2. Copy the hook file:"
    echo "   mkdir -p ~/.claude/hooks"
    echo "   cp <path-to-hook-file> ~/.claude/hooks/"
    echo "   chmod +x ~/.claude/hooks/sync-todos-to-checkboxes.py"
    echo
    exit 1
fi

run_test "Hook file exists" "test -f '$HOOK_FILE'"
run_test "Hook file is executable" "test -x '$HOOK_FILE'"

echo

# Test hook functionality
echo -e "${BLUE}Step 4: Hook Functionality Tests${NC}"
echo "--------------------------------"

# Test 1: Empty todos array
run_test "Empty todos test" "echo '{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":[]}}' | '$PYTHON_CMD' '$HOOK_FILE'" 0

# Test 2: Single todo - pending
run_test "Single pending todo" "echo '{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":[{\"content\":\"Test todo\",\"status\":\"pending\",\"activeForm\":\"Testing\"}]}}' | '$PYTHON_CMD' '$HOOK_FILE'" 2

# Test 3: Single todo - completed  
run_test "Single completed todo" "echo '{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":[{\"content\":\"Test todo\",\"status\":\"completed\",\"activeForm\":\"Testing\"}]}}' | '$PYTHON_CMD' '$HOOK_FILE'" 2

# Test 4: Multiple todos with mixed states
run_test "Mixed state todos" "echo '{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":[{\"content\":\"Task 1\",\"status\":\"completed\",\"activeForm\":\"Done\"},{\"content\":\"Task 2\",\"status\":\"in_progress\",\"activeForm\":\"Working\"},{\"content\":\"Task 3\",\"status\":\"pending\",\"activeForm\":\"Waiting\"}]}}' | '$PYTHON_CMD' '$HOOK_FILE'" 2

# Test 5: Invalid JSON (should handle gracefully)
run_test "Invalid JSON handling" "echo 'invalid-json' | '$PYTHON_CMD' '$HOOK_FILE'" 0

# Test 6: Missing arguments (should handle gracefully)  
run_test "Missing arguments handling" "echo '' | '$PYTHON_CMD' '$HOOK_FILE'" 0

echo

# Test with debug mode
echo -e "${BLUE}Step 5: Debug Mode Test${NC}"
echo "-----------------------"

export AGENT_COMM_HOOK_DEBUG=true
run_test "Debug mode execution" "echo '{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":[{\"content\":\"Debug test\",\"status\":\"completed\",\"activeForm\":\"Testing\"}]}}' | '$PYTHON_CMD' '$HOOK_FILE'" 2 verbose
unset AGENT_COMM_HOOK_DEBUG

echo

# Performance test
echo -e "${BLUE}Step 6: Performance Test${NC}"
echo "-----------------------"

# Large todo list test
large_todo_json='['
for i in {1..20}; do
    if [ $i -gt 1 ]; then large_todo_json+=','; fi
    large_todo_json+="{\"content\":\"Task $i\",\"status\":\"pending\",\"activeForm\":\"Task $i\"}"
done
large_todo_json+=']'

start_time=$(date +%s%N)
echo "{\"tool\":{\"name\":\"TodoWrite\"},\"result\":{\"todos\":$large_todo_json}}" | "$PYTHON_CMD" "$HOOK_FILE" >/dev/null 2>&1
end_time=$(date +%s%N)
execution_time=$(( (end_time - start_time) / 1000000 ))

echo "Large todo list (20 items) execution time: ${execution_time}ms"
if [ "$execution_time" -lt 100 ]; then
    echo -e "${GREEN}✅ Performance: Excellent (<100ms)${NC}"
    ((TESTS_PASSED++))
elif [ "$execution_time" -lt 500 ]; then
    echo -e "${YELLOW}⚠️  Performance: Good (<500ms)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ Performance: Poor (>500ms)${NC}"
    ((TESTS_FAILED++))
fi

echo

# Summary
echo -e "${BLUE}Verification Summary${NC}"
echo "===================="
echo "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your TodoWrite hook is properly installed and working.${NC}"
    echo
    echo "Next steps:"
    echo "1. Use TodoWrite in Claude Code to manage your todos"
    echo "2. The hook will automatically remind you to sync changes"
    echo "3. Use the agent-comm MCP server's sync_todo_checkboxes tool to sync"
    echo
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the issues above and retry.${NC}"
    echo
    echo "Common fixes:"
    echo "1. Ensure Python is installed and accessible"
    echo "2. Check hook file permissions: chmod +x ~/.claude/hooks/sync-todos-to-checkboxes.py"
    echo "3. Verify hook file exists and is copied correctly"
    echo
    exit 1
fi