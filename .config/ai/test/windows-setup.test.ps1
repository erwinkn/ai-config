$ErrorActionPreference = "Stop"
$root = Join-Path ([IO.Path]::GetTempPath()) ("ai-windows-test-" + [guid]::NewGuid())
$repo = Join-Path $root "source"
$target = Join-Path $root "home"
$profilePath = Join-Path $target "PowerShell/profile.ps1"
$source = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
New-Item -ItemType Directory -Path $target -Force | Out-Null
$env:GIT_CONFIG_GLOBAL = Join-Path $root "gitconfig"
$env:GIT_CONFIG_NOSYSTEM = "1"
$env:GIT_AUTHOR_NAME = $env:GIT_COMMITTER_NAME = "Setup test"
$env:GIT_AUTHOR_EMAIL = $env:GIT_COMMITTER_EMAIL = "test@example.invalid"
$env:AI_CONFIG_WORK_TREE = $target
$env:AI_CONFIG_GIT_DIR = Join-Path $target ".ai-config"
$env:AI_CONFIG_HOME = Join-Path $target ".config/ai"
$env:AI_CONFIG_ACTIVE_HOME = $target
$env:AI_CONFIG_STATE_HOME = Join-Path $target ".local/state/ai"
function Assert($value, $message) { if (-not $value) { throw $message } }
function Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $args" }
}
try {
    Git clone --no-hardlinks $source $repo
    # Use small portable shared settings; do not contact configured external tools.
    Set-Content (Join-Path $repo ".config/ai/shared/claude.json") '{"theme":"dark"}'
    Set-Content (Join-Path $repo ".config/ai/shared/codex.toml") 'model = "shared"'
    Git -C $repo add .config/ai/shared
    Git -C $repo commit -m "Portable settings fixture"
    $setup = Join-Path $repo ".config/ai/scripts/setup-windows-ai.ps1"
    & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath
    Assert ((Get-Content (Join-Path $target ".local/state/ai-config/install-version")) -eq "1") "Missing installation version"
    Assert ((Get-Item (Join-Path $target ".claude/skills")).LinkType -eq "SymbolicLink") "Claude skills must be a real link"
    Assert ((Get-Item (Join-Path $target ".codex/AGENTS.md")).LinkType -eq "SymbolicLink") "Codex instructions must be a real link"
    . $profilePath
    ai status
    Assert ($LASTEXITCODE -eq 0) "The registered ai function failed"
    ai pin claude theme --value light
    Assert ($LASTEXITCODE -eq 0) "Pin failed"
    & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath
    $profileLines = @(Get-Content $profilePath | Where-Object { $_ -like ". '*profile.ps1'" })
    Assert ($profileLines.Count -eq 1) "Duplicate profile registration"
    Assert ((Get-Content (Join-Path $target ".claude/settings.json") -Raw | ConvertFrom-Json).theme -eq "light") "Setup lost a pin"
    Set-Content (Join-Path $repo "update-proof.txt") "new commit"
    Git -C $repo add update-proof.txt
    Git -C $repo commit -m "Update fixture"
    & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath
    Assert (Test-Path (Join-Path $target "update-proof.txt")) "Setup did not update the mirror"
    Write-Host "Windows setup, links, profile, pins, rerun, and update passed."
}
finally { Remove-Item -LiteralPath $root -Recurse -Force }
