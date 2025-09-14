#!/bin/bash

# Script to migrate nested .logs directories to the correct structure
# Issue #50: Fix directory structure bug

echo "=== Log Migration Script for Issue #50 ==="
echo

# Function to migrate logs from nested directories
migrate_logs() {
    local base_dir="$1"
    local nested_logs="${base_dir}/.logs/.logs"
    local correct_logs="${base_dir}/.logs"

    if [ -d "$nested_logs" ]; then
        echo "Found nested logs in: $nested_logs"

        # Check if there are any log files in the nested directory
        if [ -n "$(ls -A "$nested_logs" 2>/dev/null)" ]; then
            echo "  Moving log files to: $correct_logs"

            # Move all files from nested to correct location
            for file in "$nested_logs"/*; do
                if [ -f "$file" ]; then
                    filename=$(basename "$file")

                    # If file already exists in correct location, append timestamp
                    if [ -f "$correct_logs/$filename" ]; then
                        timestamp=$(date +%Y%m%d_%H%M%S)
                        mv "$file" "$correct_logs/${filename}.migrated_${timestamp}"
                        echo "    Moved $filename (renamed with timestamp)"
                    else
                        mv "$file" "$correct_logs/"
                        echo "    Moved $filename"
                    fi
                fi
            done
        fi

        # Remove the nested .logs directory
        rmdir "$nested_logs" 2>/dev/null
        if [ ! -d "$nested_logs" ]; then
            echo "  Removed nested directory: $nested_logs"
        else
            echo "  Warning: Could not remove $nested_logs (not empty or has subdirectories)"
        fi
    fi
}

# Check and migrate known problematic directories
echo "Checking for nested .logs directories..."
echo

# Check each known directory
for dir in "./undefined" "./comm" "./test/logs"; do
    if [ -d "$dir" ]; then
        migrate_logs "$dir"
    fi
done

# Find any other nested .logs directories
echo
echo "Searching for any other nested .logs directories..."
found_nested=false

while IFS= read -r nested_dir; do
    if [ -n "$nested_dir" ]; then
        found_nested=true
        parent_dir=$(dirname "$nested_dir")
        parent_dir=$(dirname "$parent_dir")  # Go up two levels to get base
        echo "Found additional nested logs in: $parent_dir"
        migrate_logs "$parent_dir"
    fi
done < <(find . -type d -path "*/.logs/.logs" 2>/dev/null)

if [ "$found_nested" = false ]; then
    echo "No additional nested .logs directories found."
fi

# Verify the migration
echo
echo "=== Verification ==="
echo "Checking for remaining nested .logs directories..."

remaining=$(find . -type d -path "*/.logs/.logs" 2>/dev/null | wc -l)

if [ "$remaining" -eq 0 ]; then
    echo "✓ Success! No nested .logs directories remain."
else
    echo "⚠ Warning: $remaining nested .logs directories still exist:"
    find . -type d -path "*/.logs/.logs" 2>/dev/null
fi

echo
echo "Migration complete."