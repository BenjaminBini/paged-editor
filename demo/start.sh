#!/bin/bash
# Start the paged-editor web server with demo workspace
#
# Usage:
#   cd demo && ./start.sh
#   # or from project root:
#   ./demo/start.sh
#
# Open http://localhost:3000 in your browser

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="$SCRIPT_DIR/workspace"
PORT="${PORT:-3000}"

# Ensure server dependencies are installed
if [ ! -d "$PROJECT_ROOT/server/node_modules" ]; then
  echo "Installing server dependencies..."
  cd "$PROJECT_ROOT/server" && npm install
fi

# Build TypeScript sources if needed
if [ ! -d "$PROJECT_ROOT/packages/base/dist/js" ]; then
  echo "Building TypeScript sources..."
  cd "$PROJECT_ROOT/packages/base" && npm run build
fi

echo ""
echo "  Paged Editor — Demo Mode"
echo "  ========================"
echo ""
echo "  Workspace:  $WORKSPACE"
echo "  URL:        http://localhost:$PORT"
echo ""
echo "  Files:"
ls -1 "$WORKSPACE"/*.md 2>/dev/null | while read f; do
  echo "    - $(basename "$f")"
done
echo ""

cd "$PROJECT_ROOT/server"
WORKSPACE="$WORKSPACE" PORT="$PORT" node index.js
