#!/bin/sh
echo "Start Queue Consumer"
if [ "$DEVBUILD" = "true" ]; then
  echo "Development Build"
  pnpm start:dev &
else
  echo "Production Build"
  node dist/main.js &
fi

tail -f /dev/null
