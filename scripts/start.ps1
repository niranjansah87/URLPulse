#!/usr/bin/env pwsh
# URLPulse one-command launcher (Windows PowerShell).
# Thin wrapper around the cross-platform Node orchestrator.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
node scripts/start.mjs @args
exit $LASTEXITCODE
