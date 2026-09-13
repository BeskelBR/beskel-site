$ErrorActionPreference = 'Stop'
$hvbNativePnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($hvbNativePnpm) {
    & $hvbNativePnpm.Source @args
} else {
    $hvbBundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs'
    if (-not (Test-Path -LiteralPath $hvbBundledPnpm)) { throw 'Instale/disponibilize pnpm 11.19.0 e Node 24 para este projeto.' }
    & node $hvbBundledPnpm @args
}
exit $LASTEXITCODE
