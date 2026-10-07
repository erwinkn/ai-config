param(
    [string]$GitDir = (Join-Path $HOME ".ai-config"),
    [string]$WorkTree = $HOME,
    [string]$RepoUrl = "https://github.com/erwinkn/ai-config.git",
    [string]$ProfilePath = $PROFILE.CurrentUserAllHosts
)

$ErrorActionPreference = "Stop"

function Invoke-AiGit {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    & git "--git-dir=$GitDir" "--work-tree=$WorkTree" @Args
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $Args" }
}

function Get-TreePath([string]$Root, [string]$RelativePath) {
    Join-Path $Root ($RelativePath -replace "/", [IO.Path]::DirectorySeparatorChar)
}

# Find every existing path that the first checkout replaces. A directory that
# HEAD tracks must already be a real directory: replacing a linked .agents
# folder, for example, would cut off everything it points to.
function Find-CheckoutConflicts {
    $listing = (& git "--git-dir=$GitDir" ls-tree -rtz HEAD) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Git failed: ls-tree" }
    foreach ($entry in ($listing -split "`0")) {
        if (-not $entry) { continue }
        # Each entry is "<mode> <type> <object>`t<path>", and paths keep every character.
        $meta, $relativePath = $entry -split "`t", 2
        $mode, $type, $object = $meta -split " "
        $targetPath = Get-TreePath $WorkTree $relativePath
        $item = Get-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue
        if (-not $item) { continue }
        $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
        if ($type -eq "tree") {
            if ($item.PSIsContainer -and -not $isLink) { continue }
            throw "$targetPath must be a directory, not a file or link. Move it aside, then run setup again."
        }
        if ($mode -eq "120000") {
            if ($isLink) {
                # Native output loses trailing newlines, so compare the size too.
                $linkTarget = "$($item.Target)" -replace "\\", "/"
                $size = & git "--git-dir=$GitDir" cat-file -s $object
                $blob = (& git "--git-dir=$GitDir" cat-file blob $object) -join "`n"
                if ([int]$size -eq [Text.Encoding]::UTF8.GetByteCount($linkTarget) -and $blob -ceq $linkTarget) { continue }
            }
        }
        elseif (-not $item.PSIsContainer -and -not $isLink) {
            if ((& git "--git-dir=$GitDir" hash-object -- $targetPath) -eq $object) { continue }
        }
        $relativePath
    }
}

function Restore-CheckoutConflicts($Backup) {
    foreach ($relativePath in $Backup.Files) {
        $targetPath = Get-TreePath $WorkTree $relativePath
        $item = Get-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue
        # Unlike Remove-Item in Windows PowerShell, these never follow links.
        if ($item -and $item.PSIsContainer) { [IO.Directory]::Delete($targetPath, $true) }
        elseif ($item) { [IO.File]::Delete($targetPath) }
        Move-Item -LiteralPath (Get-TreePath $Backup.Root $relativePath) -Destination $targetPath
    }
}

# Identical copies stay and the others move to the backup folder, so the
# checkout may overwrite what is left. Git checks out into a separate index
# that replaces the real one only on success, so an index always means a
# finished checkout, even after an interruption. If the checkout fails, the
# copies move back and the next run retries.
function Invoke-FirstCheckout {
    if ($installationTarget) {
        # An earlier run cloned without checking out: use the validated commit.
        & git "--git-dir=$GitDir" merge-base --is-ancestor HEAD $installationTarget
        if ($LASTEXITCODE -ne 0) { throw "$GitDir has commits that its remote does not." }
        Invoke-AiGit update-ref HEAD $installationTarget
    }
    $conflicts = @(Find-CheckoutConflicts)
    $backupRoot = Join-Path $WorkTree ".local/state/ai/backups"
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'")
    $backup = [PSCustomObject]@{
        Root = Join-Path $backupRoot $stamp
        Files = New-Object System.Collections.Generic.List[string]
    }
    # Each run gets its own backup folder, even a rerun within the same second.
    for ($suffix = 2; Test-Path -LiteralPath $backup.Root; $suffix++) {
        $backup.Root = Join-Path $backupRoot "$stamp-$suffix"
    }
    $index = Join-Path $GitDir "index"
    $previousIndex = $env:GIT_INDEX_FILE
    try {
        foreach ($relativePath in $conflicts) {
            $backupPath = Get-TreePath $backup.Root $relativePath
            New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
            Move-Item -LiteralPath (Get-TreePath $WorkTree $relativePath) -Destination $backupPath
            $backup.Files.Add($relativePath)
        }
        Remove-Item -LiteralPath "$index.setup" -Force -ErrorAction SilentlyContinue
        $env:GIT_INDEX_FILE = "$index.setup"
        Invoke-AiGit checkout -f
        $env:GIT_INDEX_FILE = $previousIndex
        Move-Item -LiteralPath "$index.setup" -Destination $index
    }
    catch {
        $env:GIT_INDEX_FILE = $previousIndex
        Remove-Item -LiteralPath "$index.setup" -Force -ErrorAction SilentlyContinue
        try { Restore-CheckoutConflicts $backup }
        catch { throw "The checkout failed; copies of the files it replaced are in $($backup.Root). $_" }
        throw "The checkout failed; the files it replaced were restored. $_"
    }
    return $backup
}

function Sync-LocalProfileSnippet {
    $configDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $sourcePath = Join-Path $configDir "profile.ps1"
    $targetPath = Join-Path $WorkTree ".config\ai\profile.ps1"

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        return
    }

    $targetDir = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    if ([IO.Path]::GetFullPath($sourcePath) -ne [IO.Path]::GetFullPath($targetPath)) {
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }
}

function Assert-SymbolicLinks {
    $probe = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $probe | Out-Null
    try {
        $target = Join-Path $probe "target"
        Set-Content -LiteralPath $target -Value "probe"
        New-Item -ItemType SymbolicLink -Path (Join-Path $probe "link") -Target $target | Out-Null
    }
    catch { throw "Setup requires symbolic links. Enable Windows Developer Mode or use an elevated PowerShell session, then retry." }
    finally { Remove-Item -LiteralPath $probe -Recurse -Force }
}

function Register-AiProfile {
    $snippet = Join-Path $WorkTree ".config/ai/profile.ps1"
    $line = ". '" + $snippet.Replace("'", "''") + "'"
    if (Test-Path -LiteralPath $ProfilePath) {
        if ((Get-Content -LiteralPath $ProfilePath) -contains $line) { return }
        $backup = Join-Path $WorkTree (".local/state/ai-config/profile-backup-" + [guid]::NewGuid().ToString() + ".ps1")
        Copy-Item -LiteralPath $ProfilePath -Destination $backup
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $ProfilePath) -Force | Out-Null
    Add-Content -LiteralPath $ProfilePath -Value "`n# Load the ai command`n$line" -Encoding utf8
    Write-Host "Start a new PowerShell session, or run: $line"
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required but was not found on PATH."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
    -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js 18 or later and npm are required."
}
$nodeMajor = & node -p 'parseInt(process.versions.node)'
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 18) { throw "Node.js 18 or later is required." }

$installer = Join-Path $PSScriptRoot "../lib/install.js"
$previousWorkTree = $env:AI_CONFIG_WORK_TREE
$previousInstalling = $env:AI_CONFIG_INSTALLING
$previousConfigHome = $env:AI_CONFIG_HOME
$previousActiveHome = $env:AI_CONFIG_ACTIVE_HOME
$previousStateHome = $env:AI_CONFIG_STATE_HOME
$env:AI_CONFIG_WORK_TREE = $WorkTree
$locked = $false
function Invoke-InstallStep([string]$Step) {
    & node $installer $Step
    if ($LASTEXITCODE -ne 0) { throw "Installation step failed: $Step" }
}
try {
    Invoke-InstallStep acquire
    $locked = $true
    Assert-SymbolicLinks
    if (Test-Path -LiteralPath $GitDir) {
        Invoke-AiGit config core.symlinks true
        Invoke-AiGit remote set-url origin $RepoUrl
        Invoke-AiGit fetch
        $installationTarget = Invoke-AiGit rev-parse 'FETCH_HEAD'
        $requiredVersion = Invoke-AiGit show "${installationTarget}:.config/ai/install-version"
        if ($requiredVersion.Trim() -ne "1") { throw "The incoming layout requires a different setup release." }
    }
    Invoke-InstallStep prepare
    Invoke-InstallStep beforeCheckout
    if (-not (Test-Path -LiteralPath $GitDir)) {
        & git clone --bare $RepoUrl $GitDir
        if ($LASTEXITCODE -ne 0) { throw "Git clone failed." }
        Invoke-AiGit config core.symlinks true
    }
    if (-not (Test-Path -LiteralPath (Join-Path $GitDir "index"))) {
        # A new clone, or one that an earlier run could not check out.
        $backup = Invoke-FirstCheckout
    }
    else {
        Invoke-AiGit merge --ff-only $installationTarget
        $backup = $null
    }
    # A bare clone tracks no upstream, so a plain `ai git push` would fail.
    $branch = Invoke-AiGit symbolic-ref --short HEAD
    Invoke-AiGit config "branch.$branch.remote" origin
    Invoke-AiGit config "branch.$branch.merge" "refs/heads/$branch"
    Invoke-InstallStep restore
    Sync-LocalProfileSnippet
    Push-Location (Join-Path $WorkTree ".config/ai")
    try {
        & npm ci --omit=dev --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
    }
    finally { Pop-Location }
    $env:AI_CONFIG_INSTALLING = "1"
    $env:AI_CONFIG_HOME = Join-Path $WorkTree ".config/ai"
    $env:AI_CONFIG_ACTIVE_HOME = $WorkTree
    $env:AI_CONFIG_STATE_HOME = Join-Path $WorkTree ".local/state/ai"
    & node (Join-Path $WorkTree ".config/ai/bin/ai") capture
    if ($LASTEXITCODE -ne 0) { throw "Configuration capture failed." }
    Invoke-AiGit config status.showUntrackedFiles no
    Register-AiProfile
    Invoke-InstallStep complete
    Write-Host "AI installation version 1 is ready at $WorkTree"
    if ($backup -and $backup.Files.Count -gt 0) {
        Write-Host "Backed up conflicting files to $($backup.Root)"
    }
}
finally {
    if ($locked) { Invoke-InstallStep release }
    $env:AI_CONFIG_WORK_TREE = $previousWorkTree
    $env:AI_CONFIG_INSTALLING = $previousInstalling
    $env:AI_CONFIG_HOME = $previousConfigHome
    $env:AI_CONFIG_ACTIVE_HOME = $previousActiveHome
    $env:AI_CONFIG_STATE_HOME = $previousStateHome
}
