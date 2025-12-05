#!/bin/bash
# Counts the most common eslint-disable-next-line comments across the codebase
# Excludes node_modules and .git by default via grep

grep -r "eslint-disable-next-line" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=.q-cache \
  --include="*.ts" \
  --include="*.js" \
  --include="*.vue" | \
  sed 's/.*eslint-disable-next-line \(.*\)/\1/' | \
  tr ',' '\n' | \
  sed 's/^[ \t]*//' | \
  sed 's/[ \t]*$//' | \
  grep -v "^$" | \
  sort | \
  uniq -c | \
  sort -nr
