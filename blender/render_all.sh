#!/bin/zsh
cd "/Users/oleg/Desktop/спотик/blender"
for sc in hero ring365 history data lab story social algo swatches final; do
  echo "== $sc $(date +%T)"
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python wrapped3d.py -- $sc 2>&1 | grep -E -i "error|Traceback|Saved"
done
echo "ALL DONE $(date +%T)"
