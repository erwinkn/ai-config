function ai {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $cli = Join-Path $HOME ".config\ai\bin\ai"
    if (-not (Test-Path -LiteralPath $cli)) {
        Write-Error "ai CLI not found at $cli. Run scripts/setup-windows-ai.ps1 first."
        return
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js 18 or later is required for the ai CLI."
        return
    }

    & node $cli @Args
}
