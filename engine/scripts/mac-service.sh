#!/bin/bash
# Run the Magik edit engine as a background service on this Mac (a LaunchAgent).
#
#   engine/scripts/mac-service.sh install     copy the engine out of the repo and start it
#   engine/scripts/mac-service.sh update      same as install: re-copy after engine changes
#   engine/scripts/mac-service.sh stop        stop and remove the service
#   engine/scripts/mac-service.sh status      is it running?
#   engine/scripts/mac-service.sh logs        follow the log
#
# The engine runs from ~/Library/Application Support, not from the repo: macOS
# blocks background services from reading Desktop/Documents/Downloads, and this
# avoids granting Node access to those folders. Only the three keys it needs are
# copied into a private env file (readable by you only).
set -euo pipefail

LABEL="com.magik.edit-engine"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
HOME_DIR="$HOME/Library/Application Support/Magik Edit Engine"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/magik-edit-engine.log"
DOMAIN="gui/$(id -u)"
NODE="$(command -v node)"
FFMPEG_DIR="$(dirname "$(command -v ffmpeg)")"

stop() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  # bootout returns before the service is gone; bootstrapping too early fails with error 5.
  for _ in $(seq 1 20); do
    launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 || return 0
    sleep 0.5
  done
}

install() {
  [ -n "$NODE" ] || { echo "node is not installed"; exit 1; }
  [ -x "$FFMPEG_DIR/ffmpeg" ] || { echo "ffmpeg is not installed"; exit 1; }
  [ -d "$REPO/engine/node_modules" ] || (cd "$REPO/engine" && pnpm install --ignore-workspace)

  mkdir -p "$HOME_DIR"
  rsync -a --delete --exclude test --exclude scripts --exclude .env "$REPO/engine/" "$HOME_DIR/engine/"

  # Private env file with just what the engine needs.
  ( umask 077
    grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL|SUPABASE_SECRET_KEY|ANTHROPIC_API_KEY|WHISPER_CPP_MODEL|WHISPER_VAD_MODEL|WHISPER_LANGUAGE|GOOGLE_SERVICE_ACCOUNT_FILE|GOOGLE_SERVICE_ACCOUNT_KEY|ENGINE_CACHE_GB|APIFY_TOKEN)=' "$REPO/.env.local" > "$HOME_DIR/engine.env" )
  for key in SUPABASE_SECRET_KEY ANTHROPIC_API_KEY; do
    grep -q "^$key=" "$HOME_DIR/engine.env" || { echo "Missing $key in .env.local"; exit 1; }
  done

  stop
  mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--env-file=$HOME_DIR/engine.env</string>
    <string>$HOME_DIR/engine/src/worker.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME_DIR/engine</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$FFMPEG_DIR:$(dirname "$NODE"):/usr/bin:/bin</string>
    <key>ENGINE_WORK_DIR</key><string>$HOME_DIR/work</string>
    <key>ENGINE_CACHE_DIR</key><string>$HOME_DIR/cache</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <!-- Not "Background": macOS keeps those on efficiency cores with throttled disk, which
       made contact sheets ~10x slower. Nice 5 still lets the apps you are using come first. -->
  <key>ProcessType</key><string>Standard</string>
  <key>Nice</key><integer>5</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
  plutil -lint "$PLIST" >/dev/null
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "Edit engine installed and started. Log: $LOG"
}

case "${1:-}" in
  install | update) install ;;
  stop)
    stop
    rm -f "$PLIST"
    echo "Edit engine stopped. Its copy stays in $HOME_DIR (delete it to remove completely)."
    ;;
  status)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      launchctl print "$DOMAIN/$LABEL" | grep -E '^\s+(state|pid|last exit code) =' | head -3
    else
      echo "not installed"
    fi
    ;;
  logs) tail -f "$LOG" ;;
  *)
    echo "usage: $0 install|update|stop|status|logs"
    exit 1
    ;;
esac
