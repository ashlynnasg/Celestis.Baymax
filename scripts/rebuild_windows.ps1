try {
    . (Join-Path $PSScriptRoot 'windows-common.ps1')
    $node = Get-CompatibleNode
    if (-not $node) { throw 'Run setup_windows.cmd first.' }
    $env:PATH = (Split-Path -Parent $node) + ';' + $env:PATH
    $npx = Join-Path (Split-Path -Parent $node) 'npx.cmd'
    if (-not (Test-Path -LiteralPath $npx)) { throw 'Install the full Node.js 24 LTS distribution (including npm/npx).' }
    & $npx '--yes' 'pnpm@9.12.0' 'install' '--frozen-lockfile'
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & $node 'node_modules\typescript\bin\tsc' '--noEmit'
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript checks failed.' }
    & $node 'node_modules\vitest\vitest.mjs' 'run'
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
    & $node 'scripts\build-local.mjs'
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    Write-Host 'Rebuild complete. Run start_windows.cmd.' -ForegroundColor Green
    exit 0
} catch {
    Write-Host "`nRebuild failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
