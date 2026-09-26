#!/data/data/com.termux/files/usr/bin/env bash
# OpenDroid Sandbox — status check for the 10 simulated networks + LLM gateway.
# Prints WebSocket reachability + REST latency per component.

set -e

API_BASE="${OPENDROID_API:-http://localhost:8001/api}"
NETWORKS=(facebook instagram youtube twitter tiktok whatsapp linkedin reddit threads dropdashin)

C_GREEN=$'\e[38;5;46m'
C_CYAN=$'\e[38;5;51m'
C_RED=$'\e[38;5;196m'
C_DIM=$'\e[38;5;244m'
C_RST=$'\e[0m'

hr() { printf "${C_DIM}%s${C_RST}\n" "----------------------------------------------------"; }

echo -e "${C_GREEN}[OpenDroid] status check @ $(date -u +%Y-%m-%dT%H:%M:%SZ)${C_RST}"
hr

echo -e "${C_CYAN}> API root${C_RST}"
if curl -sf --max-time 3 "${API_BASE}/" -o /tmp/od.json ; then
    echo "  ok  $(cat /tmp/od.json | head -c 120)…"
else
    echo -e "  ${C_RED}FAIL${C_RST} API unreachable at ${API_BASE}"
    exit 1
fi

hr
echo -e "${C_CYAN}> LLM gateway${C_RST}"
curl -sf --max-time 3 "${API_BASE}/llm/status" | tr ',' '\n' | sed 's/^/  /'

hr
echo -e "${C_CYAN}> Network feeds${C_RST}"
for n in "${NETWORKS[@]}"; do
    start=$(date +%s%N)
    if curl -sf --max-time 3 "${API_BASE}/feed/${n}?limit=1" -o /dev/null ; then
        end=$(date +%s%N)
        ms=$(( (end - start) / 1000000 ))
        printf "  %-14s ${C_GREEN}ok${C_RST} %sms\n" "$n" "$ms"
    else
        printf "  %-14s ${C_RED}FAIL${C_RST}\n" "$n"
    fi
done

hr
echo -e "${C_CYAN}> Aggregate state${C_RST}"
curl -sf --max-time 3 "${API_BASE}/state" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);t=d['totals'];print(f\"  tick={d['tick']} uptime={d['uptime_s']}s earnings=\${t['earnings']:.2f} impressions={t['impressions']} conv={t['conversions']}\")" \
    || echo -e "  ${C_RED}FAIL${C_RST}"

hr
echo -e "${C_GREEN}[OpenDroid] done.${C_RST}"
