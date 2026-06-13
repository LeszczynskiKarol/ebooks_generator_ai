$ErrorActionPreference = 'Stop'
$log = 'D:\ebooks_generator_ai\tunnel\_setup.log'
function L($m){ $m | Tee-Object -FilePath $log -Append }
try {
  '' | Set-Content $log
  $tunnel  = 'D:\ebooks_generator_ai\tunnel'
  $ver     = '0.61.1'
  $zip     = Join-Path $env:TEMP "frp_$ver.zip"
  $extract = Join-Path $env:TEMP "frp_$ver"

  L "Adding Defender exclusions..."
  Add-MpPreference -ExclusionPath $tunnel    -ErrorAction SilentlyContinue
  Add-MpPreference -ExclusionPath $extract   -ErrorAction SilentlyContinue
  Add-MpPreference -ExclusionPath $zip       -ErrorAction SilentlyContinue
  Add-MpPreference -ExclusionProcess 'frpc.exe' -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  L ("Exclusions now: " + ((Get-MpPreference).ExclusionPath -join '; '))

  if (-not (Test-Path $zip)) {
    L "Downloading frp $ver..."
    Invoke-WebRequest -Uri "https://github.com/fatedier/frp/releases/download/v$ver/frp_${ver}_windows_amd64.zip" -OutFile $zip -UseBasicParsing
  }
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  L "Extracting..."
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $frpc = Get-ChildItem -Path $extract -Recurse -Filter 'frpc.exe' | Select-Object -First 1
  Copy-Item $frpc.FullName -Destination (Join-Path $tunnel 'frpc.exe') -Force
  L ("Copied frpc.exe -> " + (Join-Path $tunnel 'frpc.exe'))
  $v = & (Join-Path $tunnel 'frpc.exe') --version
  L ("frpc version: " + $v)
  L "SETUP-OK"
} catch {
  L ("SETUP-ERR: " + $_.Exception.Message)
}
