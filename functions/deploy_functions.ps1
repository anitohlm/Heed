# Deploy Azure Functions for Heed.
#
# Run from the repo root:
#   .\functions\deploy_functions.ps1
#
# What this does:
#   1. Pre-flight: verifies func CLI and Azure login.
#   2. Copies agents/ into functions/agents/ so the module is bundled
#      with the deployment (Azure can't reach ../agents/ at runtime).
#   3. Publishes to func-heed-flex using the Azure Functions Core Tools.
#   4. Removes the temporary agents/ copy from functions/ (always, even on error).

$ErrorActionPreference = "Stop"
$repoRoot  = Split-Path -Parent $PSScriptRoot
$agentsSrc = Join-Path $repoRoot "agents"
$agentsDst = Join-Path $PSScriptRoot "agents"

# ── Pre-flight checks ──────────────────────────────────────────────────────────
Write-Host "Checking prerequisites..."

if (-not (Get-Command func -ErrorAction SilentlyContinue)) {
    Write-Error "Azure Functions Core Tools (func) not found. Install from https://aka.ms/azfunc-install"
}

$loginCheck = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not logged in to Azure CLI. Run: az login"
}

# ── Copy agents/ into functions/ ──────────────────────────────────────────────
Write-Host "Copying agents/ into functions/ for deployment..."
if (Test-Path $agentsDst) {
    Remove-Item $agentsDst -Recurse -Force
}
Copy-Item $agentsSrc $agentsDst -Recurse

# ── Publish (always clean up agents/ copy, even on failure) ───────────────────
Push-Location $PSScriptRoot
try {
    Write-Host "Publishing func-heed-flex..."
    # --build remote: Flex Consumption + Python v2 needs the package built on
    # the server. Without this flag, routes 404 at runtime even though functions
    # appear registered in the management plane.
    func azure functionapp publish func-heed-flex --python --build remote
    if ($LASTEXITCODE -ne 0) {
        throw "func publish failed (exit $LASTEXITCODE)"
    }
} finally {
    Pop-Location
    Write-Host "Cleaning up temporary agents/ copy..."
    if (Test-Path $agentsDst) {
        Remove-Item $agentsDst -Recurse -Force
    }
}

Write-Host "Done."
