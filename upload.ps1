# Chrome Web Store Upload ZIP Creation Script
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$sourceDir = Join-Path $PSScriptRoot "dev"
$zipFile = Join-Path $PSScriptRoot "file-manager-pro.zip"

Write-Host "Generating ZIP file: $zipFile" -ForegroundColor Cyan

# Delete existing ZIP file if it exists
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
    Write-Host "Removed existing ZIP file." -ForegroundColor Yellow
}

# Get files and folders under dev directory and compress them
Get-ChildItem -Path $sourceDir | Compress-Archive -DestinationPath $zipFile

Write-Host "Compression completed successfully!" -ForegroundColor Green
