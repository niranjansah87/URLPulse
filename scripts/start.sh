#!/usr/bin/env bash
# URLPulse one-command launcher (Linux / macOS).
# Thin wrapper around the cross-platform Node orchestrator.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/start.mjs "$@"
