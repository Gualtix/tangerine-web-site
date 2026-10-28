#!/usr/bin/env bash
# Regenerates every PNG icon, favicon and iOS splash from mark.svg (the white logo mark, 32x32 units).
# Needs rsvg-convert (brew install librsvg). Run from anywhere: ./icons/generate.sh
#
# Each layout is a tangerine canvas with the mark centred through a nested <svg>: its viewBox is a square
# of 2k mark units around the mark's centre, so the mark (27 units tall) fills 27/(2k) of the canvas'
# shorter side. Maskable icons keep it well inside the central 80% safe zone.
set -euo pipefail
cd "$(dirname "$0")"

BG='#E99B3F'
MARK=$(sed -e '/<!--/,/-->/d' -e '/<svg/d' -e '/<\/svg>/d' mark.svg)

# svg <width> <height> <k> <corner radius as a fraction of the width, 0 = square, full bleed>
svg() {
  local v; v=$(awk "BEGIN { print 16-$3, 16-$3, 2*$3, 2*$3 }")
  printf '<svg xmlns="http://www.w3.org/2000/svg" width="%s" height="%s" viewBox="0 0 %s %s"><rect width="100%%" height="100%%" rx="%s" fill="%s"/><svg width="100%%" height="100%%" viewBox="%s">%s</svg></svg>\n' \
    "$1" "$2" "$1" "$2" "$(awk "BEGIN { print $1*$4 }")" "$BG" "$v" "$MARK"
}
# png <file> <width> <height> <k> <radius>
png() { svg "$2" "$3" "$4" "$5" | rsvg-convert -o "$1"; }

# "any" icons and favicons: rounded tile, mark at 60% (favicons 74%, so it survives 16px)
svg 512 512 22.5 .22 > icon.svg
png icon-192.png 192 192 22.5 .22
png icon-512.png 512 512 22.5 .22
svg 32 32 18.25 .22 > favicon.svg
png favicon-32.png 32 32 18.25 .22
png favicon-16.png 16 16 18.25 .22
# maskable: full bleed, mark at 46% so launcher masks (circle, squircle) never clip it
png maskable-192.png 192 192 29.5 0
png maskable-512.png 512 512 29.5 0
# iOS rounds the corners itself and needs an opaque square
png apple-touch-icon.png 180 180 22.5 0

# iOS splash, portrait: <css width> <css height> <pixel ratio>. Mark at 30% of the width.
# The <link rel="apple-touch-startup-image"> media queries in index.html must list the same set.
mkdir -p splash
while read -r w h r; do
  png "splash/splash-${w}x${h}@${r}x.png" $((w * r)) $((h * r)) 45 0
done <<'SIZES'
440 956 3
420 912 3
402 874 3
430 932 3
393 852 3
390 844 3
428 926 3
375 812 3
414 896 3
414 896 2
375 667 2
SIZES
echo "icons written to $(pwd)"
