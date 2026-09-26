#!/data/data/com.termux/files/usr/bin/env bash
# logs_stream.sh — colored, filtered tail of critical OpenDroid events.
# Targets: AntiBotShield alarms, WebSocket errors, LLM gateway failures.
# Optimized for the small Termux screen — only the important stuff.

LOG="${OPENDROID_LOG:-/var/log/supervisor/backend.err.log}"

C_G=$'\e[38;5;46m'; C_C=$'\e[38;5;51m'; C_R=$'\e[38;5;196m'
C_A=$'\e[38;5;214m'; C_D=$'\e[38;5;244m'; C_X=$'\e[0m'

if [[ ! -r "$LOG" ]]; then
    echo "log file not readable: $LOG (override with OPENDROID_LOG=...)"
    exit 1
fi

echo -e "${C_G}[OpenDroid] streaming ${LOG}${C_X}  (Ctrl-C to stop)"

tail -n 40 -F "$LOG" | while IFS= read -r line; do
    case "$line" in
        *AntiBotShield*|*BAN*|*ban*)
            echo -e "${C_R}⚠ $line${C_X}" ;;
        *ERROR*|*Exception*|*Traceback*)
            echo -e "${C_R}✖ $line${C_X}" ;;
        *WARN*|*warning*)
            echo -e "${C_A}▲ $line${C_X}" ;;
        *ws*|*WebSocket*|*websocket*)
            echo -e "${C_C}∿ $line${C_X}" ;;
        *LLM*|*gateway*|*Ollama*)
            echo -e "${C_G}◉ $line${C_X}" ;;
        *)
            echo -e "${C_D}· $line${C_X}" ;;
    esac
done
