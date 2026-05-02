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

Write-Host "Publishing func-heed..."
Set-Location $functionsDir
func azure functionapp publish func-heed --python

Write-Host "Cleaning up temporary agents/ copy..."
Remove-Item $agentsDst -Recurse -Force

Write-Host "Done."
