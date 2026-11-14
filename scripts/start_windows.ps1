try {
    . (Join-Path $PSScriptRoot 'windows-common.ps1')
    $node = Get-CompatibleNode
    if (-not $node) { throw 'Run setup_windows.cmd first, or install Node.js 24 LTS.' }
    & $node 'scripts\start-local.mjs'
    exit $LASTEXITCODE
} catch {
    Write-Host "`nStartup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
