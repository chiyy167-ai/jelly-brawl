# 一键启动本地项目：联机服务器 2567 + 客户端 5174，然后打开浏览器。
# 用法：双击 start-local.bat，或在本目录执行  powershell -ExecutionPolicy Bypass -File .\start-local.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'apps\server'
$clientDir = Join-Path $root 'apps\client'
$clientUrl = 'http://127.0.0.1:5174/'

function Test-PortOpen([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $wait = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $wait.AsyncWaitHandle.WaitOne(400, $false) -and $client.Connected
    return [bool]$ok
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Ensure-Deps([string]$Dir, [string]$Name) {
  if (Test-Path (Join-Path $Dir 'node_modules')) { return }
  Write-Host "$Name 还没有依赖，正在 npm ci ..."
  Push-Location $Dir
  try { npm ci } finally { Pop-Location }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '没有找到 Node.js。请先安装 Node.js 20 或更高版本。'
  exit 1
}

Ensure-Deps $serverDir '联机服务器'
Ensure-Deps $clientDir '客户端'

function Start-AppWindow([string]$Dir, [string]$Title, [string]$Command) {
  # 单独开一个窗口，关掉启动脚本也不会把服务一起关掉
  Start-Process -FilePath 'powershell.exe' -WorkingDirectory $Dir -ArgumentList @(
    '-NoExit',
    '-NoProfile',
    '-Command',
    "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
  ) | Out-Null
}

if (Test-PortOpen 2567) {
  Write-Host '联机服务器已在 2567 运行，跳过启动。'
} else {
  Write-Host '启动联机服务器：ws://0.0.0.0:2567'
  Start-AppWindow $serverDir 'Jelly Brawl 服务器' 'npm start'
}

if (Test-PortOpen 5174) {
  Write-Host '客户端已在 5174 运行，跳过启动。'
} else {
  Write-Host '启动客户端：http://127.0.0.1:5174/'
  Start-AppWindow $clientDir 'Jelly Brawl 客户端' 'npx vite --host --port 5174'
}

Write-Host '等待客户端就绪...'
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
  if (Test-PortOpen 5174) { break }
  Start-Sleep -Milliseconds 400
}

if (-not (Test-PortOpen 5174)) {
  Write-Host '客户端 45 秒内没有起来。请看「Jelly Brawl 客户端」窗口里的报错。'
  exit 1
}

$lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
    $_.PrefixOrigin -in 'Dhcp', 'Manual' -and
    $_.InterfaceAlias -notmatch 'vEthernet|WSL|Hyper-V|Virtual|VMware|VMnet|Loopback|蓝牙|Bluetooth'
  } |
  Select-Object -ExpandProperty IPAddress -Unique
if ($lan) {
  Write-Host '同一 Wi-Fi 的手机可以打开：'
  foreach ($ip in $lan) {
    Write-Host ('  http://' + $ip + ':5174/')
  }
}

Start-Process $clientUrl
Write-Host "已打开 $clientUrl"
Write-Host '关掉「Jelly Brawl 服务器」和「Jelly Brawl 客户端」两个窗口即可停止。'
