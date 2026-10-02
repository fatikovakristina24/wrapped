#!/bin/zsh
cd "/Users/oleg/Desktop/спотик/blender"
for sc in hero ring365 history data lab story social algo final swatches exports; do
  echo "== $sc $(date +%T)"
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python objects3d.py -- $sc 2>&1 | grep -E -i "error|Traceback|Saved"
done
echo "ALL DONE $(date +%T)"
