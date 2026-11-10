param([string]$Archiwum)
$ErrorActionPreference = 'Stop'
$nodeVersion = (& node --version)
if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 24) { throw 'Wymagany Node.js 24 lub nowszy.' }
$repo = Split-Path $PSScriptRoot -Parent
$repos = Split-Path $repo -Parent
$devRoot = Join-Path $env:LOCALAPPDATA 'FoundryDev-14.370'
$appPath = Join-Path $devRoot 'app'
$dataPath = Join-Path $devRoot 'userdata'
$mainPath = Join-Path $appPath 'main.js'
if (-not (Test-Path -LiteralPath $mainPath)) {
    if (-not $Archiwum) { $Archiwum = (Read-Host 'Pelna sciezka do ZIP Foundry 14.370 Node.js').Trim('"') }
    if (-not (Test-Path -LiteralPath $Archiwum -PathType Leaf) -or [IO.Path]::GetExtension($Archiwum) -ne '.zip') { throw 'Nie znaleziono ZIP.' }
    if ((Test-Path -LiteralPath $appPath) -and (Get-ChildItem -LiteralPath $appPath -Force | Select-Object -First 1)) { throw "Katalog nie jest pusty: $appPath. Niczego nie nadpisano." }
    New-Item -ItemType Directory -Path $appPath -Force | Out-Null
    Expand-Archive -LiteralPath $Archiwum -DestinationPath $appPath
    if (-not (Test-Path -LiteralPath $mainPath)) { throw 'Brak main.js. Sprawdz, czy ZIP zawiera dystrybucje Node.js.' }
}
foreach ($folder in @('Config','Data/systems','Data/modules','Data/worlds')) { New-Item -ItemType Directory -Path (Join-Path $dataPath $folder) -Force | Out-Null }
function Dodaj-Dowiazanie([string]$Sciezka, [string]$Cel, [string]$DozwolonyStaryCel) {
    $entry = Get-Item -LiteralPath $Sciezka -Force -ErrorAction SilentlyContinue
    if ($entry) {
        $targets = @($entry.Target)
        if ($entry.LinkType -eq 'Junction' -and $targets.Count -eq 1) {
            $targetPath = [IO.Path]::GetFullPath($targets[0]).TrimEnd('\')
            if ($targetPath -eq [IO.Path]::GetFullPath($Cel).TrimEnd('\')) { return }
            if ($DozwolonyStaryCel -and $targetPath -eq [IO.Path]::GetFullPath($DozwolonyStaryCel).TrimEnd('\')) {
                # Directory.Delete usuwa sam punkt junction, a nie pliki katalogu docelowego.
                [System.IO.Directory]::Delete($Sciezka)
                New-Item -ItemType Junction -Path $Sciezka -Target $Cel | Out-Null
                Write-Host 'Zaktualizowano dowiazanie Damage Vignette na gotowy katalog dist.'
                return
            }
        }
        throw "Sciezka juz istnieje: $Sciezka. Niczego nie nadpisano."
    }
    New-Item -ItemType Junction -Path $Sciezka -Target $Cel | Out-Null
}
Dodaj-Dowiazanie (Join-Path $dataPath 'Data/systems/l5r5e') (Join-Path $repo 'system') $null
foreach ($name in @('enhancedcombathud-l5r5e','l5r5e-combat-tracker-dock','l5r5e-tactical-grid','L5R-damage-vignette','L5R5e-Reactive-Token-Ring','lib-wrapper')) {
    $source = Join-Path $repos $name
    $manifestPath = Join-Path $source 'module.json'
    if (Test-Path -LiteralPath $manifestPath) {
        $id = (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).id
        if (-not $id -or $id -notmatch '^[a-zA-Z0-9_-]+$') { throw "Niepoprawne ID modulu: $manifestPath" }
        $packagePath = $source
        if ($name -eq 'L5R-damage-vignette') {
            $packagePath = Join-Path $source 'dist'
            $packageManifest = Join-Path $packagePath 'module.json'
            $bundle = Join-Path $packagePath 'main.bundle.js'
            if (-not (Test-Path -LiteralPath $packageManifest) -or -not (Test-Path -LiteralPath $bundle)) {
                Write-Host 'Buduje L5R Resource Vignette...'
                Push-Location $source
                try { & npm run build; if ($LASTEXITCODE -ne 0) { throw 'Build L5R Resource Vignette nie powiodl sie.' } }
                finally { Pop-Location }
            }
            if (-not (Test-Path -LiteralPath $packageManifest) -or -not (Test-Path -LiteralPath $bundle)) {
                throw "Build L5R Resource Vignette nie utworzyl wymaganych plikow w $packagePath."
            }
        }
        if ($name -eq 'lib-wrapper') {
            $style = Join-Path $source 'dist/lib-wrapper.css'
            $sharedVersion = Join-Path $source 'src/shared/version.js'
            if (-not (Test-Path -LiteralPath $sharedVersion)) {
                Write-Host 'Pobiera wymagany submodul src/shared dla libWrapper...'
                Push-Location $source
                try {
                    & git -c 'url.https://github.com/.insteadOf=git@github.com:' submodule update --init --recursive
                    if ($LASTEXITCODE -ne 0) { throw 'Nie udalo sie pobrac submodulu src/shared libWrapper.' }
                }
                finally { Pop-Location }
            }
            if (-not (Test-Path -LiteralPath $sharedVersion)) {
                throw "Brakuje $sharedVersion po inicjalizacji submodulu."
            }
            if (-not (Test-Path -LiteralPath $style)) {
                Push-Location $source
                try {
                    Write-Host 'Instaluje zaleznosci developerskie libWrapper...'
                    & npm ci
                    if ($LASTEXITCODE -ne 0) { throw 'Instalacja zaleznosci libWrapper nie powiodla sie.' }
                    Write-Host 'Buduje libWrapper...'
                    & npm run build
                    if ($LASTEXITCODE -ne 0) { throw 'Build libWrapper nie powiodl sie.' }
                }
                finally { Pop-Location }
            }
            if (-not (Test-Path -LiteralPath $style)) {
                throw "Build libWrapper nie utworzyl wymaganego pliku $style."
            }
        }
        $legacyPath = if ($name -eq 'L5R-damage-vignette') { $source } else { $null }
        Dodaj-Dowiazanie (Join-Path $dataPath "Data/modules/$id") $packagePath $legacyPath
    }
}
if (Get-NetTCPConnection -LocalPort 30001 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 30001 jest zajety. Zatrzymaj poprzednia instancje testowa.' }
Write-Host "Dane testowe: $dataPath"
Write-Host 'Otworz http://127.0.0.1:30001 i potwierdz wersje 14.370. Zatrzymanie: Ctrl+C.'
& node $mainPath "--dataPath=$dataPath" '--port=30001' '--hotReload' '--noupnp'
