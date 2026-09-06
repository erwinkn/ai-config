param(
    [string]$GitDir = (Join-Path $HOME ".ai-config"),
    [string]$WorkTree = $HOME,
    [string]$RepoUrl = "https://github.com/erwinkn/ai-config.git"
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

function Backup-ConflictingTrackedFiles {
    $trackedFiles = & git "--git-dir=$GitDir" ls-tree -r --name-only HEAD
    $backupRoot = Join-Path $HOME (".ai-config-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    $backedUpFiles = New-Object System.Collections.Generic.List[string]

    foreach ($relativePath in $trackedFiles) {
        $targetPath = Join-Path $WorkTree ($relativePath -replace "/", [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
            continue
        }

        $repoBlob = & git "--git-dir=$GitDir" show ("HEAD:{0}" -f $relativePath)
        $workingCopy = [IO.File]::ReadAllText($targetPath)
        if ($repoBlob -eq $workingCopy) {
            continue
        }

        $backupPath = Join-Path $backupRoot ($relativePath -replace "/", [IO.Path]::DirectorySeparatorChar)
        $backupDir = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }

        Move-Item -LiteralPath $targetPath -Destination $backupPath -Force
        $backedUpFiles.Add($relativePath) | Out-Null
    }

    return [PSCustomObject]@{
        Root = $backupRoot
        Files = $backedUpFiles
    }
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
    if (Test-Path -LiteralPath $GitDir) {
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
        $backup = Backup-ConflictingTrackedFiles
        Invoke-AiGit checkout
    }
    else {
        Invoke-AiGit merge --ff-only $installationTarget
        $backup = $null
    }
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
