@echo off
REM ---------------------------------------------------------------------------
REM JJ - mise a jour quotidienne des offres.
REM
REM Relance le pipeline d'ingestion : les nouvelles offres entrent, celles qui
REM ont disparu des sources pendant 3 passages (pourvues / retirees) sortent, et
REM celles publiees il y a plus de 30 jours sortent aussi.
REM
REM Declenche par le Planificateur de taches Windows (voir installer-tache.ps1).
REM Lancable a la main pour tester : double-clic sur ce fichier.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0.."

if not exist "journaux" mkdir "journaux"
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set JOUR=%%d
set LOG=journaux\maj-%JOUR%.log

echo [%DATE% %TIME%] demarrage>> "%LOG%"
node ingestion\pipeline.js >> "%LOG%" 2>&1
set CODE=%ERRORLEVEL%
echo [%DATE% %TIME%] termine, code %CODE%>> "%LOG%"

REM On ne garde que les 14 derniers journaux.
powershell -NoProfile -Command "Get-ChildItem 'journaux\maj-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force"

exit /b %CODE%
