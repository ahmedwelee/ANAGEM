#!/usr/bin/env bash
# Starts the backend (internal port 8080), waits until it answers, then the website on $PORT (the only public port).
set -u
SERVER_PORT=8080 java $JAVA_OPTS -jar app.jar &
until (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; do sleep 2; done
exec node web/server/server.mjs
