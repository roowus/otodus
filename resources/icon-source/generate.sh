#!/bin/bash
# Generate app icons from Icon Composer .icon project
# Produces: resources/build/icon.icns (macOS), resources/build/icon.png (fallback), resources/icon.png (tray)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ICON_SOURCE="$SCRIPT_DIR/icon.icon"
BUILD_DIR="$PROJECT_DIR/resources/build"
RESOURCES_DIR="$PROJECT_DIR/resources"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

MAGICK_BIN=$(command -v magick || true)
if [ -z "$MAGICK_BIN" ]; then
  echo "Error: ImageMagick is required to trim the small macOS icon slots." >&2
  echo "Install with: brew install imagemagick" >&2
  exit 1
fi

echo "Compiling icon from $ICON_SOURCE..."

# Generate .icns using actool (requires Xcode)
xcrun actool \
  --compile "$TMP_DIR" \
  --platform macosx \
  --minimum-deployment-target 10.12 \
  --app-icon icon \
  --output-partial-info-plist "$TMP_DIR/partial.plist" \
  "$ICON_SOURCE" >/dev/null

if [ ! -f "$TMP_DIR/icon.icns" ]; then
  echo "Error: actool failed to produce icon.icns" >&2
  exit 1
fi

cp "$TMP_DIR/icon.icns" "$BUILD_DIR/icon.icns"

# Icon Composer renders the tile edge-to-edge, but every other macOS app leaves Apple's 100px
# margin around an 824px tile. Without this the Dock icon draws ~24% larger than its neighbours.
node "$PROJECT_DIR/config/scripts/desktop-distribution/macos/inset-macos-icon-canvas.mjs" \
  "$BUILD_DIR/icon.icns"
echo "  -> resources/build/icon.icns"

# Extract PNG fallbacks from the unmodified compiled icon; small-slot trimming is
# only for the macOS .icns list representations.
sips -s format png --resampleWidth 1024 "$TMP_DIR/icon.icns" --out "$BUILD_DIR/icon.png" >/dev/null 2>&1
echo "  -> resources/build/icon.png (1024x1024)"

sips -s format png --resampleWidth 256 "$TMP_DIR/icon.icns" --out "$RESOURCES_DIR/icon.png" >/dev/null 2>&1
echo "  -> resources/icon.png (256x256)"

# #5357: Windows scales the safe-area-inset 1024px render into undersized taskbar/Open-with icons.
# Use the repo’s pngjs trim script to remove the inset, re-square with 2% margin and emit multi-size ICO,
# keeping committed output reproducible without ImageMagick.
node "$PROJECT_DIR/config/scripts/desktop-distribution/windows/trim-windows-icon-source.mjs"
echo "  -> resources/build/icon.ico (trimmed, filled multi-size ICO)"

echo "Done! Icons generated in resources/build/ and resources/"
