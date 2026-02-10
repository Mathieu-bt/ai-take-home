param(
  [int]$PreferredPort = 8080
)

$ErrorActionPreference = "Stop"

function Test-PortInUse {
  param([int]$Port)
  $result = netstat -ano | Select-String ":$Port"
  return ($null -ne $result)
}

function Find-FreePort {
  param([int]$StartPort)
  $port = $StartPort
  while (Test-PortInUse -Port $port) {
    $port++
    if ($port -gt ($StartPort + 50)) {
      throw "No free port found between $StartPort and $($StartPort + 50)."
    }
  }
  return $port
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$port = Find-FreePort -StartPort $PreferredPort
Write-Host "Starting demo API on http://127.0.0.1:$port" -ForegroundColor Green
Write-Host "Use Ctrl+C to stop."

python -m uvicorn server:app --host 127.0.0.1 --port $port --reload
