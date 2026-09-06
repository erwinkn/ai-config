function ai {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $aiHome = if ($env:AI_CONFIG_WORK_TREE) { $env:AI_CONFIG_WORK_TREE } else { $HOME }
    $cli = Join-Path $aiHome ".config\ai\bin\ai"
    if (-not (Test-Path -LiteralPath $cli)) {
        Write-Error "ai CLI not found at $cli. Run .config/ai/scripts/setup-windows-ai.ps1 first."
        return
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js 18 or later is required for the ai CLI."
        return
    }

    $nodeMajor = & node -p 'parseInt(process.versions.node)'
    if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 18) {
        Write-Error "Node.js 18 or later is required for the ai CLI."
        return
    }
    & node $cli @Args
}
