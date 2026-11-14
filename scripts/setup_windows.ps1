try {
    . (Join-Path $PSScriptRoot 'windows-common.ps1')
    Write-Host 'Celestial Baymax - Windows / SQLite setup' -ForegroundColor Magenta
    if (-not (Test-Path -LiteralPath 'dist\init-db.mjs') -or -not (Test-Path -LiteralPath 'web-dist\index.html')) {
        throw 'The ready-to-run build is missing. Extract the entire ZIP or run rebuild_windows.cmd.'
    }
    $node = Get-CompatibleNode
    if (-not $node) { Install-LocalNode; $node = Get-CompatibleNode }
    if (-not $node) { throw 'Install Node.js 24 LTS from https://nodejs.org, then run setup_windows.cmd again.' }
    Write-Host "Using Node.js: $node"
    & $node 'dist\init-db.mjs'
    if ($LASTEXITCODE -ne 0) { throw "Database initialization failed (exit $LASTEXITCODE)." }
    Write-Host ''
    Write-Host 'Setup complete. Double-click start_windows.cmd.' -ForegroundColor Green
    exit 0
} catch {
    Write-Host "`nSetup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'If the download is blocked, install Node.js 24 LTS manually and run setup again.'
    exit 1
}
