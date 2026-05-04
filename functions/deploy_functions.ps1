# Deploy Azure Functions for Heed.
#
# Run from the repo root:
#   .\functions\deploy_functions.ps1
#
# What this does:
#   1. Copies agents/ into functions/agents/ so the module is bundled
#      with the deployment (Azure can't reach ../agents/ at runtime).
#   2. Publishes to func-heed using the Azure Functions Core Tools.
#   3. Removes the temporary agents/ copy from functions/.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$functionsDir = $PSScriptRoot
$agentsSrc = Join-Path $repoRoot "agents"
$agentsDst = Join-Path $functionsDir "agents"

Write-Host "Copying agents/ into functions/ for deployment..."
if (Test-Path $agentsDst) {
    Remove-Item $agentsDst -Recurse -Force
}
Copy-Item $agentsSrc $agentsDst -Recurse

Write-Host "Publishing func-heed-flex..."
Set-Location $functionsDir
# --build remote: Flex Consumption + Python v2 needs the package built on
# the server, not locally. Without this flag the deploy "succeeds" and
# functions show in `az functionapp function list`, but every HTTP route
# 404s because the worker can't load the indexed functions.
func azure functionapp publish func-heed-flex --python --build remote

Write-Host "Cleaning up temporary agents/ copy..."
Remove-Item $agentsDst -Recurse -Force

Write-Host "Done."
