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

    Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required but was not found on PATH."
}

if (-not (Test-Path -LiteralPath $GitDir)) {
    & git clone --bare $RepoUrl $GitDir
}
else {
    & git "--git-dir=$GitDir" remote set-url origin $RepoUrl
    & git "--git-dir=$GitDir" fetch origin
}

Invoke-AiGit config status.showUntrackedFiles no
$backup = Backup-ConflictingTrackedFiles
Invoke-AiGit checkout
Sync-LocalProfileSnippet

Write-Host "AI dotfiles bare repo is installed at $GitDir"
if ($backup.Files.Count -gt 0) {
    Write-Host "Backed up conflicting files to $($backup.Root):"
    foreach ($file in $backup.Files) {
        Write-Host "  $file"
    }
}
else {
    Write-Host "No conflicting tracked files needed backup."
}
