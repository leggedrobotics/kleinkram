#!/bin/bash
echo "Starting Backend (Production)"

# Start the application using the production command from package.json
# Execute it directly using node for better signal handling than 'yarn start:prod'
# Run in the background to allow seeding check
node dist/backend/src/main.js &

# Capture the PID of the main application process
APP_PID=$!
echo "Application process started with PID $APP_PID"

echo "Application running in foreground. Monitoring PID $APP_PID."
# Wait for the main application process to exit.
# This ensures the container stays running as long as the app is running,
# and exits when the app exits (or crashes).
wait $APP_PID

EXIT_CODE=$?
echo "Application process $APP_PID exited with code $EXIT_CODE."
exit $EXIT_CODE