$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$MavenVersion = "3.9.9"
$MavenHome = Join-Path $ProjectRoot ".mvn\apache-maven-$MavenVersion"
$MavenZip = Join-Path $ProjectRoot ".mvn\apache-maven-$MavenVersion-bin.zip"
$MavenUrl = "https://archive.apache.org/dist/maven/maven-3/$MavenVersion/binaries/apache-maven-$MavenVersion-bin.zip"

if (-not $env:JAVA_HOME) {
  $DefaultJava = "C:\Program Files\Java\jdk-17"
  if (Test-Path (Join-Path $DefaultJava "bin\java.exe")) {
    $env:JAVA_HOME = $DefaultJava
  }
}

if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  throw "JAVA_HOME is not set and Java was not found at C:\Program Files\Java\jdk-17"
}

if (-not (Test-Path $MavenHome)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot ".mvn") | Out-Null

  if (-not (Test-Path $MavenZip)) {
    Write-Host "Downloading Apache Maven $MavenVersion..."
    Invoke-WebRequest -Uri $MavenUrl -OutFile $MavenZip
  }

  Write-Host "Extracting Apache Maven $MavenVersion..."
  Expand-Archive -Force -Path $MavenZip -DestinationPath (Join-Path $ProjectRoot ".mvn")
}

$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$(Join-Path $MavenHome 'bin');$env:PATH"
Write-Host "Maven bootstrap ready: $MavenHome"
