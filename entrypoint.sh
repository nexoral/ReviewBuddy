#!/bin/bash

# Review Buddy - Entrypoint Script
# This script bootstraps the main application logic safely.

set -e

# Ensure we are in the action's directory (crucial for local referencing)
# If the script is run via ${{ github.action_path }}, $0 will include the path.
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Make the source directory executable (just in case)
chmod +x "$SCRIPT_DIR/src/main.sh"
chmod +x "$SCRIPT_DIR/src/utils.sh"
chmod +x "$SCRIPT_DIR/src/github.sh"
chmod +x "$SCRIPT_DIR/src/gemini.sh"

# Delegate to the main logic script
exec "$SCRIPT_DIR/src/main.sh"
