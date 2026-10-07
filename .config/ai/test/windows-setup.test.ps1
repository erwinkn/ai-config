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
function Invoke-TestGit {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $args" }
}
try {
    Invoke-TestGit clone --no-hardlinks $source $repo
    # Use small portable shared settings; do not contact configured external tools.
    Set-Content (Join-Path $repo ".config/ai/shared/claude.json") '{"theme":"dark"}'
    Set-Content (Join-Path $repo ".config/ai/shared/codex.toml") 'model = "shared"'
    Invoke-TestGit -C $repo add .config/ai/shared
    Invoke-TestGit -C $repo commit -m "Portable settings fixture"
    # Plain copies from before setup: identical, edited, and real files where links belong.
    New-Item -ItemType Directory -Path (Join-Path $target ".agents"), (Join-Path $target ".codex"), (Join-Path $target ".claude/skills/personal") -Force | Out-Null
    Copy-Item (Join-Path $repo ".agents/AGENTS.md") (Join-Path $target ".agents/AGENTS.md")
    Set-Content (Join-Path $target ".gitignore") "local ignore"
    Set-Content (Join-Path $target ".codex/AGENTS.md") "local instructions"
    Set-Content (Join-Path $target ".claude/skills/personal/SKILL.md") "personal skill"
    $setup = Join-Path $repo ".config/ai/scripts/setup-windows-ai.ps1"
    # A file where HEAD has a directory stops setup before any change.
    Set-Content (Join-Path $target ".agents/skills") "not a directory"
    $refused = $null
    try { & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath }
    catch { $refused = "$_" }
    Assert ($refused -like "*must be a directory*") "Setup replaced a file where a directory belongs"
    Assert ((Get-Content (Join-Path $target ".agents/skills")) -eq "not a directory") "Setup changed the refused file"
    Assert (-not (Test-Path (Join-Path $env:AI_CONFIG_GIT_DIR "index"))) "A refused setup left an index"
    Remove-Item (Join-Path $target ".agents/skills")
    # The next run checks out the newest validated commit, not the earlier clone.
    Set-Content (Join-Path $repo "resume-proof.txt") "newer commit"
    Invoke-TestGit -C $repo add resume-proof.txt
    Invoke-TestGit -C $repo commit -m "Commit after the first clone"
    & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath
    Assert (Test-Path (Join-Path $target "resume-proof.txt")) "Setup checked out a stale commit"
    Assert ((Get-Content (Join-Path $target ".local/state/ai-config/install-version")) -eq "1") "Missing installation version"
    Assert ((Get-Item (Join-Path $target ".claude/skills")).LinkType -eq "SymbolicLink") "Claude skills must be a real link"
    Assert ((Get-Item (Join-Path $target ".codex/AGENTS.md")).LinkType -eq "SymbolicLink") "Codex instructions must be a real link"
    $backup = @(Get-ChildItem (Join-Path $target ".local/state/ai/backups"))[0].FullName
    Assert ((Get-Content (Join-Path $backup ".gitignore")) -eq "local ignore") "Setup lost an edited copy"
    Assert ((Get-Content (Join-Path $backup ".codex/AGENTS.md")) -eq "local instructions") "Setup lost a file in a link's place"
    Assert ((Get-Content (Join-Path $backup ".claude/skills/personal/SKILL.md")) -eq "personal skill") "Setup lost a directory in a link's place"
    Assert (-not (Test-Path (Join-Path $backup ".agents/AGENTS.md"))) "Setup backed up an identical copy"
    Assert ((& git "--git-dir=$env:AI_CONFIG_GIT_DIR" "--work-tree=$target" status --porcelain --untracked-files=no) -eq $null) "The first checkout is not clean"
    $branch = & git "--git-dir=$env:AI_CONFIG_GIT_DIR" symbolic-ref --short HEAD
    Assert ((& git "--git-dir=$env:AI_CONFIG_GIT_DIR" config "branch.$branch.merge") -eq "refs/heads/$branch") "The mirror branch must track origin"
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
    Invoke-TestGit -C $repo add update-proof.txt
    Invoke-TestGit -C $repo commit -m "Update fixture"
    & $setup -GitDir $env:AI_CONFIG_GIT_DIR -WorkTree $target -RepoUrl $repo -ProfilePath $profilePath
    Assert (Test-Path (Join-Path $target "update-proof.txt")) "Setup did not update the mirror"
    Write-Host "Windows setup, links, profile, pins, rerun, and update passed."
}
finally { Remove-Item -LiteralPath $root -Recurse -Force }
