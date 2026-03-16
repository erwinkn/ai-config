param()

$ErrorActionPreference = "Stop"

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-ScoopPackage {
    param(
        [string]$CommandName,
        [string]$PackageName
    )

    if (Test-Command $CommandName) {
        Write-Host "$CommandName already installed"
        return
    }

    if (-not (Test-Command "scoop")) {
        throw "scoop is required to install $PackageName."
    }

    Write-Host "Installing $PackageName with scoop"
    & scoop install $PackageName
}

Ensure-ScoopPackage -CommandName "uv" -PackageName "uv"
Ensure-ScoopPackage -CommandName "bun" -PackageName "bun"

Write-Host "Installing skillx with bun"
& bun install -g skillx

Write-Host "Installing agent-browser with bun"
& bun install -g agent-browser

Write-Host "Installing Chrome for agent-browser"
& agent-browser install

Write-Host "Installed tools:"
& uv --version
& bun --version
& skillx --help
& agent-browser --version
