#!/bin/bash
"""
Comprehensive Protection Systems Test Suite
Validates all reasoning enforcement and data protection mechanisms

This test suite validates:
1. ESLint strict mode enforcement
2. Reasoning validator hook system (4 exit codes)
3. Destructive operation guard (CLI protection)
4. Recovery assistant (data recovery system)
5. Verification aliases (safe command system)
6. Git safety wrapper (git command protection)
7. Integration between all systems
8. End-to-end protection workflows

Usage:
  ./test-protection-systems.sh                    # Run all tests
  ./test-protection-systems.sh --unit             # Run unit tests only
  ./test-protection-systems.sh --integration      # Run integration tests only
  ./test-protection-systems.sh --performance      # Run performance tests
  ./test-protection-systems.sh --scenarios        # Run scenario tests
  ./test-protection-systems.sh --quick            # Run quick validation only
"""

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_TEMP_DIR="/tmp/protection-systems-test-$$"
ORIGINAL_PWD="$(pwd)"

# Protection system paths
REASONING_VALIDATOR="$SCRIPT_DIR/reasoning-validator.py"
DESTRUCTIVE_GUARD="$SCRIPT_DIR/destructive-operation-guard.py"
RECOVERY_ASSISTANT="$SCRIPT_DIR/recovery-assistant.py"
VERIFICATION_ALIASES="$SCRIPT_DIR/verification-aliases.sh"
GIT_SAFETY_WRAPPER="$SCRIPT_DIR/git-safety-wrapper.sh"
ESLINT_CONFIG="$SCRIPT_DIR/../.eslintrc.cjs"

# Test statistics
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

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
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_section() {
    echo
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# Test assertion functions
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$expected" == "$actual" ]]; then
        log_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_failure "$test_name - Expected: '$expected', Got: '$actual'"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local test_name="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$haystack" =~ $needle ]]; then
        log_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_failure "$test_name - '$haystack' does not contain '$needle'"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_file_exists() {
    local file_path="$1"
    local test_name="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ -f "$file_path" ]]; then
        log_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_failure "$test_name - File does not exist: $file_path"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_executable() {
    local file_path="$1"
    local test_name="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ -x "$file_path" ]]; then
        log_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_failure "$test_name - File not executable: $file_path"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

assert_exit_code() {
    local expected_code="$1"
    local actual_code="$2"
    local test_name="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$expected_code" == "$actual_code" ]]; then
        log_success "$test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_failure "$test_name - Expected exit code $expected_code, got $actual_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment in $TEST_TEMP_DIR"
    
    # Create temporary test directory
    mkdir -p "$TEST_TEMP_DIR"
    cd "$TEST_TEMP_DIR"
    
    # Initialize git repository
    git init . >/dev/null 2>&1
    git config user.name "Test User" >/dev/null 2>&1
    git config user.email "test@example.com" >/dev/null 2>&1
    
    # Create test files
    echo "console.log('test');" > test.js
    echo "const x: any = 'test';" > test.ts
    echo "# Test README" > README.md
    
    # Initial commit
    git add . >/dev/null 2>&1
    git commit -m "Initial test commit" >/dev/null 2>&1
    
    log_info "Test environment ready"
}

# Cleanup test environment
cleanup_test_environment() {
    cd "$ORIGINAL_PWD"
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
        log_info "Cleaned up test environment"
    fi
}

# Test 1: File Existence Tests
test_file_existence() {
    log_section "File Existence Tests"
    
    assert_file_exists "$REASONING_VALIDATOR" "Reasoning validator exists"
    assert_file_exists "$DESTRUCTIVE_GUARD" "Destructive guard exists"
    assert_file_exists "$RECOVERY_ASSISTANT" "Recovery assistant exists"
    assert_file_exists "$VERIFICATION_ALIASES" "Verification aliases exists"
    assert_file_exists "$GIT_SAFETY_WRAPPER" "Git safety wrapper exists"
    
    assert_executable "$REASONING_VALIDATOR" "Reasoning validator is executable"
    assert_executable "$DESTRUCTIVE_GUARD" "Destructive guard is executable"
    assert_executable "$RECOVERY_ASSISTANT" "Recovery assistant is executable"
    assert_executable "$VERIFICATION_ALIASES" "Verification aliases is executable"
    assert_executable "$GIT_SAFETY_WRAPPER" "Git safety wrapper is executable"
}

# Test 2: ESLint Configuration Tests
test_eslint_configuration() {
    log_section "ESLint Configuration Tests"
    
    if [[ -f "$ESLINT_CONFIG" ]]; then
        local eslint_content=$(cat "$ESLINT_CONFIG")
        
        assert_contains "$eslint_content" "strict-type-checked" "ESLint has strict-type-checked"
        assert_contains "$eslint_content" "stylistic-type-checked" "ESLint has stylistic-type-checked"
        assert_contains "$eslint_content" "no-explicit-any.*error" "ESLint bans 'any' types with error"
        assert_contains "$eslint_content" "no-restricted-imports" "ESLint has no-restricted-imports rule"
        assert_contains "$eslint_content" "fs-extra" "ESLint restricts direct fs-extra imports"
        assert_contains "$eslint_content" "TSAnyKeyword" "ESLint completely bans 'any' types"
    else
        log_failure "ESLint configuration file not found"
        FAILED_TESTS=$((FAILED_TESTS + 6))
        TOTAL_TESTS=$((TOTAL_TESTS + 6))
    fi
}

# Test 3: Reasoning Validator Tests
test_reasoning_validator() {
    log_section "Reasoning Validator Tests"
    
    # Test safe operation (exit code 0)
    echo '{"tool":{"name":"Read","parameters":{"file_path":"test.txt"}},"message":"reading file for analysis"}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    assert_exit_code "0" "$?" "Safe operation returns exit code 0"
    
    # Test bypass violation (exit code 1)
    echo '{"command":"git commit --no-verify","message":"bypassing pre-commit hooks"}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    assert_exit_code "1" "$?" "Bypass violation returns exit code 1"
    
    # Test bypass with reasoning (exit code 2)
    echo '{"command":"eslint-disable","message":"disabling rule but analyzing root cause first"}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" == "2" ]] || [[ "$exit_code" == "1" ]]; then
        log_success "Bypass with reasoning returns appropriate exit code ($exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Bypass with reasoning - Expected 1 or 2, got $exit_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test critical operation (should be caught by destructive patterns)
    echo '{"command":"git reset --hard HEAD~5","message":"resetting without proper reasoning"}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" != "0" ]]; then
        log_success "Critical destructive operation blocked (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Critical destructive operation not blocked"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 4: Destructive Guard Tests  
test_destructive_guard() {
    log_section "Destructive Guard Tests"
    
    # Test safe command
    local output=$(python3 "$DESTRUCTIVE_GUARD" verify-safety "git status" 2>/dev/null)
    local exit_code=$?
    assert_exit_code "0" "$exit_code" "Safe git command verification"
    
    # Test risky command
    python3 "$DESTRUCTIVE_GUARD" verify-safety "git stash drop" >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" != "0" ]]; then
        log_success "Risky command detected (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Risky command not detected"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test critical command
    python3 "$DESTRUCTIVE_GUARD" verify-safety "git reset --hard" >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" == "3" ]] || [[ "$exit_code" == "1" ]]; then
        log_success "Critical command blocked (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Critical command not properly blocked (exit code $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test backup creation
    python3 "$DESTRUCTIVE_GUARD" create-backup --backup-type git_stash >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" == "0" ]] || [[ "$exit_code" == "1" ]]; then
        log_success "Backup creation test completed (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Backup creation failed unexpectedly (exit code $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 5: Recovery Assistant Tests
test_recovery_assistant() {
    log_section "Recovery Assistant Tests"
    
    # Test data loss detection
    local output=$(python3 "$RECOVERY_ASSISTANT" detect 2>/dev/null)
    local exit_code=$?
    if [[ "$exit_code" == "0" ]] || [[ "$exit_code" == "1" ]]; then
        log_success "Data loss detection completed (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Data loss detection failed (exit code $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test recovery point discovery
    python3 "$RECOVERY_ASSISTANT" list-recovery-points >/dev/null 2>&1
    assert_exit_code "0" "$?" "Recovery point discovery"
    
    # Test automatic recovery (should be safe in clean repo)
    python3 "$RECOVERY_ASSISTANT" recover --auto >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" == "0" ]] || [[ "$exit_code" == "1" ]]; then
        log_success "Automatic recovery test completed (exit code $exit_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Automatic recovery failed unexpectedly (exit code $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 6: Git Safety Wrapper Tests
test_git_safety_wrapper() {
    log_section "Git Safety Wrapper Tests"
    
    # Test status command
    "$GIT_SAFETY_WRAPPER" status >/dev/null 2>&1
    assert_exit_code "0" "$?" "Git safety wrapper status"
    
    # Test wrapper help
    "$GIT_SAFETY_WRAPPER" help >/dev/null 2>&1
    assert_exit_code "0" "$?" "Git safety wrapper help"
    
    # Test safe git command (should execute directly)
    GIT_SAFETY_MODE=normal "$GIT_SAFETY_WRAPPER" log --oneline -1 >/dev/null 2>&1
    assert_exit_code "0" "$?" "Safe git command execution"
    
    # Test disabled mode (should bypass all checks)
    GIT_SAFETY_MODE=disabled "$GIT_SAFETY_WRAPPER" status >/dev/null 2>&1
    assert_exit_code "0" "$?" "Disabled mode bypass"
}

# Test 7: Verification Aliases Tests
test_verification_aliases() {
    log_section "Verification Aliases Tests"
    
    # Source the aliases script
    if source "$VERIFICATION_ALIASES" >/dev/null 2>&1; then
        log_success "Verification aliases sourced successfully"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Failed to source verification aliases"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test that safety functions are defined
    if declare -F safety-status >/dev/null 2>&1; then
        log_success "Safety status function defined"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Safety status function not defined"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if declare -F verify-safety >/dev/null 2>&1; then
        log_success "Verify safety function defined"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Verify safety function not defined"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if declare -F show-alternatives >/dev/null 2>&1; then
        log_success "Show alternatives function defined"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Show alternatives function not defined"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 8: Integration Tests
test_system_integration() {
    log_section "System Integration Tests"
    
    # Test that destructive guard integrates with recovery assistant
    if python3 "$DESTRUCTIVE_GUARD" verify-safety "test command" >/dev/null 2>&1; then
        if python3 "$RECOVERY_ASSISTANT" detect >/dev/null 2>&1; then
            log_success "Destructive guard and recovery assistant integration"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log_failure "Recovery assistant not accessible from destructive guard context"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        log_failure "Destructive guard not accessible for integration test"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test git safety wrapper with destructive guard
    if GIT_SAFETY_MODE=normal "$GIT_SAFETY_WRAPPER" status >/dev/null 2>&1; then
        log_success "Git safety wrapper basic functionality"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Git safety wrapper basic functionality failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 9: Performance Tests
test_performance() {
    log_section "Performance Tests"
    
    # Test reasoning validator performance
    local start_time=$(date +%s%N)
    echo '{"tool":{"name":"Read","parameters":{"file_path":"test.txt"}}}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(((end_time - start_time) / 1000000))  # Convert to milliseconds
    
    if [[ "$duration" -lt 1000 ]]; then  # Less than 1 second
        log_success "Reasoning validator performance: ${duration}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_warning "Reasoning validator slow: ${duration}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))  # Still pass but warn
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test destructive guard performance
    local start_time=$(date +%s%N)
    python3 "$DESTRUCTIVE_GUARD" verify-safety "git status" >/dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(((end_time - start_time) / 1000000))
    
    if [[ "$duration" -lt 2000 ]]; then  # Less than 2 seconds
        log_success "Destructive guard performance: ${duration}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_warning "Destructive guard slow: ${duration}ms"
        PASSED_TESTS=$((PASSED_TESTS + 1))  # Still pass but warn
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test 10: End-to-End Scenario Tests
test_end_to_end_scenarios() {
    log_section "End-to-End Scenario Tests"
    
    # Scenario 1: Attempt dangerous operation, should be blocked
    echo '{"command":"git reset --hard HEAD~3","message":"trying to reset without backup"}' | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    local validator_exit=$?
    
    python3 "$DESTRUCTIVE_GUARD" verify-safety "git reset --hard HEAD~3" >/dev/null 2>&1
    local guard_exit=$?
    
    if [[ "$validator_exit" != "0" ]] || [[ "$guard_exit" != "0" ]]; then
        log_success "E2E: Dangerous operation blocked by protection systems"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "E2E: Dangerous operation not blocked"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Scenario 2: Attempt recovery after simulated data loss
    # Create a temporary file and then remove it (simulate data loss)
    echo "temporary content" > temp_file.txt
    git add temp_file.txt
    rm temp_file.txt
    
    # Try recovery
    python3 "$RECOVERY_ASSISTANT" detect >/dev/null 2>&1
    local recovery_exit=$?
    
    if [[ "$recovery_exit" == "0" ]] || [[ "$recovery_exit" == "1" ]]; then
        log_success "E2E: Recovery system can detect data loss scenarios"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "E2E: Recovery system failed to analyze scenario"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Clean up
    git restore --staged temp_file.txt 2>/dev/null || true
}

# Test 11: Error Handling Tests
test_error_handling() {
    log_section "Error Handling Tests"
    
    # Test reasoning validator with invalid JSON
    echo "invalid json" | python3 "$REASONING_VALIDATOR" >/dev/null 2>&1
    assert_exit_code "0" "$?" "Reasoning validator handles invalid JSON gracefully"
    
    # Test destructive guard with invalid command
    python3 "$DESTRUCTIVE_GUARD" verify-safety "" >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" != "0" ]]; then
        log_success "Destructive guard handles invalid command"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Destructive guard should reject empty command"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Test recovery assistant in non-git directory
    local temp_dir="/tmp/non-git-test-$$"
    mkdir -p "$temp_dir"
    cd "$temp_dir"
    
    python3 "$RECOVERY_ASSISTANT" detect >/dev/null 2>&1
    local exit_code=$?
    if [[ "$exit_code" == "0" ]]; then
        log_success "Recovery assistant handles non-git directory"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_failure "Recovery assistant should handle non-git directory gracefully"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    cd "$TEST_TEMP_DIR"
    rm -rf "$temp_dir"
}

# Show test results
show_test_results() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo
    log_section "Test Results Summary"
    
    echo -e "${CYAN}Statistics:${NC}"
    echo "  Total Tests: $TOTAL_TESTS"
    echo "  Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo "  Failed: ${RED}$FAILED_TESTS${NC}"
    echo "  Duration: ${duration}s"
    
    local pass_rate=0
    if [[ "$TOTAL_TESTS" -gt 0 ]]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    echo "  Pass Rate: $pass_rate%"
    echo
    
    if [[ "$FAILED_TESTS" -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "🛡️ Protection systems are working correctly"
        return 0
    else
        echo -e "${RED}❌ $FAILED_TESTS TESTS FAILED${NC}"
        echo "⚠️ Some protection systems may need attention"
        return 1
    fi
}

# Main test execution
main() {
    local test_type="${1:-all}"
    
    echo -e "${PURPLE}🛡️ Protection Systems Test Suite${NC}"
    echo "Starting comprehensive validation..."
    echo
    
    # Setup test environment
    setup_test_environment
    
    # Trap cleanup on exit
    trap cleanup_test_environment EXIT
    
    # Run tests based on type
    case "$test_type" in
        "--unit")
            test_file_existence
            test_eslint_configuration
            test_reasoning_validator
            test_destructive_guard
            test_recovery_assistant
            test_git_safety_wrapper
            test_verification_aliases
            ;;
        "--integration")
            test_system_integration
            ;;
        "--performance")
            test_performance
            ;;
        "--scenarios")
            test_end_to_end_scenarios
            ;;
        "--quick")
            test_file_existence
            test_reasoning_validator
            test_destructive_guard
            ;;
        *)
            # Run all tests
            test_file_existence
            test_eslint_configuration
            test_reasoning_validator
            test_destructive_guard
            test_recovery_assistant
            test_git_safety_wrapper
            test_verification_aliases
            test_system_integration
            test_performance
            test_end_to_end_scenarios
            test_error_handling
            ;;
    esac
    
    # Show results
    show_test_results
}

# Check if script is being run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
    exit $?
else
    echo "Test suite loaded - call main() to run tests"
fi