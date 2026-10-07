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

# Move every existing path that the first checkout replaces into the backup
# folder. Directories are listed too, so a file or link where HEAD has a
# directory is replaced rather than followed.
function Move-CheckoutConflicts($Backup) {
    $listing = (& git "--git-dir=$GitDir" ls-tree -rtz HEAD) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Git failed: ls-tree" }
    $replaced = $null
    foreach ($entry in ($listing -split "`0")) {
        if (-not $entry) { continue }
        $meta, $relativePath = $entry -split "`t", 2
        $mode, $type, $object = $meta -split " "
        if ($replaced -and $relativePath.StartsWith("$replaced/")) { continue }
        $targetPath = Get-TreePath $WorkTree $relativePath
        $item = Get-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue
        if (-not $item) { continue }
        $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
        if ($type -eq "tree") {
            if ($item.PSIsContainer -and -not $isLink) { continue }
        }
        elseif ($mode -eq "120000") {
            $linkTarget = & git "--git-dir=$GitDir" cat-file blob $object
            if ($isLink -and ("$($item.Target)" -replace "\\", "/") -eq $linkTarget) { continue }
        }
        elseif (-not $item.PSIsContainer -and -not $isLink) {
            if ((& git "--git-dir=$GitDir" hash-object -- $targetPath) -eq $object) { continue }
        }
        $backupPath = Get-TreePath $Backup.Root $relativePath
        New-Item -ItemType Directory -Path (Split-Path -Parent $backupPath) -Force | Out-Null
        Move-Item -LiteralPath $targetPath -Destination $backupPath
        $Backup.Files.Add($relativePath)
        $replaced = $relativePath
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
# checkout may overwrite what is left. If it fails, move the copies back and
# drop the index, which Git writes even after a partial checkout: without an
# index, the next run retries this checkout instead of updating.
function Invoke-FirstCheckout {
    $backup = [PSCustomObject]@{
        Root = Join-Path $WorkTree (".local/state/ai/backups/" +
            (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'"))
        Files = New-Object System.Collections.Generic.List[string]
    }
    try {
        Move-CheckoutConflicts $backup
        Invoke-AiGit checkout -f
    }
    catch {
        Remove-Item -LiteralPath (Join-Path $GitDir "index") -Force -ErrorAction SilentlyContinue
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
