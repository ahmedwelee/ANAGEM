#!/bin/sh
# Assembles web/index.html from web/partials/*.html (one partial per page section).
cd "$(dirname "$0")/.." && cat web/partials/*.html > web/index.html && echo "built web/index.html ($(wc -l < web/index.html) lines)"
