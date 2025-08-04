# FFmpeg Installation Guide

This guide provides comprehensive instructions for installing FFmpeg with SRT support across different operating systems.

## Overview

FFmpeg is required for the stream inspection project to generate test streams and handle video processing. The installation must include SRT (Secure Reliable Transport) protocol support for streaming to AWS MediaConnect.

## Quick Installation

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install ffmpeg
```

### Windows
```powershell
choco install ffmpeg
```

## Detailed Installation Instructions

### macOS

#### Homebrew (Recommended)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install FFmpeg with comprehensive codec support
brew install ffmpeg

# Verify installation and SRT support
ffmpeg -version | head -3
ffmpeg -protocols | grep srt
```

### Linux

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install FFmpeg (includes SRT support in recent versions)
sudo apt install ffmpeg

# For older Ubuntu versions, use snap for newer FFmpeg
sudo snap install ffmpeg

# Verify SRT support
ffmpeg -protocols | grep srt
```

#### CentOS/RHEL/Rocky Linux
```bash
# Enable EPEL repository
sudo dnf install epel-release

# Enable RPM Fusion (required for FFmpeg)
sudo dnf install https://download1.rpmfusion.org/free/el/rpmfusion-free-release-$(rpm -E %rhel).noarch.rpm

# Install FFmpeg
sudo dnf install ffmpeg

# Verify installation
ffmpeg -protocols | grep srt
```

### Windows

#### Option 1: Chocolatey (Recommended)
```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install FFmpeg
choco install ffmpeg

# Verify installation
ffmpeg -protocols | findstr srt
```

#### Option 2: Manual Installation
1. **Download FFmpeg**:
   - Visit [https://ffmpeg.org/download.html#build-windows](https://ffmpeg.org/download.html#build-windows)
   - Choose a build from gyan.dev or BtbN (includes SRT support)
   - Download the "full" build for complete codec support

2. **Extract and Install**:
   ```powershell
   # Extract to C:\ffmpeg
   # Add C:\ffmpeg\bin to your PATH environment variable
   
   # Via PowerShell (run as Administrator)
   $env:PATH += ";C:\ffmpeg\bin"
   [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::Machine)
   ```

3. **Verify Installation**:
   ```powershell
   ffmpeg -version
   ffmpeg -protocols | findstr srt
   ```

## Integration with Project

### Conda Environment
The project's conda environment uses system FFmpeg (Homebrew on macOS) to ensure SRT support:

```bash
# Create environment (uses system FFmpeg)
conda env create -f environment.yml
conda activate stream-inspection

# Verify SRT support
ffmpeg -protocols | grep srt
```
## References

- [FFmpeg Official Documentation](https://ffmpeg.org/documentation.html)
- [SRT Protocol Documentation](https://github.com/Haivision/srt)
- [FFmpeg Compilation Guide](https://trac.ffmpeg.org/wiki/CompilationGuide)
- [AWS MediaConnect SRT Documentation](https://docs.aws.amazon.com/mediaconnect/latest/ug/protocols-srt.html)
