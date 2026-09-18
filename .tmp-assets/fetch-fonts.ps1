$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fontsDir = Join-Path $root 'public\fonts'
New-Item -ItemType Directory -Force -Path $fontsDir | Out-Null

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
$url = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap'

$cssPath = Join-Path $PSScriptRoot 'fonts.css'
curl.exe -s -A $ua $url -o $cssPath
$css = Get-Content -Path $cssPath -Raw -Encoding UTF8
Write-Output ("CSS 长度: " + $css.Length)

$blocks = [regex]::Matches($css, '@font-face\s*\{[^}]+\}')
Write-Output ("@font-face 数量: " + $blocks.Count)

foreach ($block in $blocks) {
  $text = $block.Value
  if ($text -notmatch 'U\+0000-00FF') { continue }

  $style = if ($text -match 'font-style:\s*italic') { 'italic' } else { 'normal' }
  $match = [regex]::Match($text, 'url\((https://[^)]+\.woff2)\)')
  if (-not $match.Success) { continue }

  $src = $match.Groups[1].Value
  $name = "instrument-serif-latin-400-$style.woff2"
  $target = Join-Path $fontsDir $name
  curl.exe -s -L $src -o $target
  $size = (Get-Item $target).Length
  Write-Output ("$name  $size bytes  <- $src")
}

Get-ChildItem $fontsDir | ForEach-Object { Write-Output ("OUTPUT " + $_.Name + " " + $_.Length) }
