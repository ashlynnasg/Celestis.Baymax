$ErrorActionPreference = 'Stop'
$env:NODE_NO_WARNINGS = '1'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Get-CompatibleNode {
    $candidates = @((Join-Path $ProjectRoot '.runtime\node\node.exe'))
    $installed = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($installed) { $candidates += $installed.Source }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        try {
            $null = & $candidate '--no-warnings' (Join-Path $ProjectRoot 'scripts\check-runtime.cjs') 2>$null
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch { }
    }
    return $null
}

function Install-LocalNode {
    Write-Host 'Downloading official Node.js 24 LTS for this folder...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
    if ($architecture -eq 'ARM64') { $nodeArch = 'arm64' }
    elseif ($architecture -eq 'AMD64') { $nodeArch = 'x64' }
    else { throw 'A 64-bit Windows laptop is required. Install Node.js 24 LTS manually if automatic detection is unavailable.' }
    $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing -TimeoutSec 120
    $release = $releases | Where-Object { $_.version -match '^v24\.' -and $_.lts -and $_.files -contains "win-$nodeArch-zip" } | Select-Object -First 1
    if (-not $release) { throw 'Could not find the official Node.js 24 LTS Windows download.' }
    $name = "node-$($release.version)-win-$nodeArch"
    $archiveName = "$name.zip"
    $base = "https://nodejs.org/dist/$($release.version)"
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('baymax-node-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary | Out-Null
    try {
        $archive = Join-Path $temporary $archiveName
        Invoke-WebRequest -Uri "$base/$archiveName" -OutFile $archive -UseBasicParsing -TimeoutSec 300
        $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 120).Content
        $match = [regex]::Match($sums, '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($archiveName) + '\s*$')
        if (-not $match.Success) { throw 'The official SHA-256 checksum was not found.' }
        $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
        if ($actual -ne $match.Groups[1].Value) { throw 'Node.js download checksum mismatch. Run setup again.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $temporary
        $runtime = Join-Path $ProjectRoot '.runtime'
        New-Item -ItemType Directory -Path $runtime -Force | Out-Null
        $destination = Join-Path $runtime 'node'
        if (Test-Path -LiteralPath $destination) {
            Move-Item -LiteralPath $destination -Destination (Join-Path $runtime ('node-old-' + [Guid]::NewGuid().ToString('N')))
        }
        Move-Item -LiteralPath (Join-Path $temporary $name) -Destination $destination
    } finally { Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue }
}
