function ai {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $gitDir = Join-Path $HOME ".ai-config"
    if (-not (Test-Path -LiteralPath $gitDir)) {
        Write-Error "Bare AI dotfiles repo not found at $gitDir. Run scripts/setup-windows-ai.ps1 first."
        return
    }

    & git "--git-dir=$gitDir" "--work-tree=$HOME" @Args
}
