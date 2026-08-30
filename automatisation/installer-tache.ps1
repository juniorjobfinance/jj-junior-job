# ---------------------------------------------------------------------------
# JJ - installe la mise a jour quotidienne dans le Planificateur de taches.
#
# A lancer UNE FOIS, clic droit > "Executer avec PowerShell" (ou depuis un
# terminal PowerShell place dans ce dossier) :
#     powershell -ExecutionPolicy Bypass -File .\installer-tache.ps1
#
# La tache tourne tous les jours a 06h30. Si le PC est eteint a cette heure-la,
# Windows rattrape le passage au demarrage suivant (StartWhenAvailable).
# Pour changer l'heure : -Heure "07:15". Pour desinstaller : -Supprimer.
# ---------------------------------------------------------------------------
param(
  [string]$Heure = '06:30',
  [switch]$Supprimer
)

$ErrorActionPreference = 'Stop'
$nom     = 'JJ - mise a jour des offres'
$script  = Join-Path $PSScriptRoot 'maj-quotidienne.cmd'

if ($Supprimer) {
  Unregister-ScheduledTask -TaskName $nom -Confirm:$false
  Write-Host "Tache '$nom' supprimee."
  return
}

if (-not (Test-Path $script)) { throw "Introuvable : $script" }

$action    = New-ScheduledTaskAction -Execute $script
$trigger   = New-ScheduledTaskTrigger -Daily -At $Heure
$reglages  = New-ScheduledTaskSettingsSet -StartWhenAvailable `
                                          -DontStopIfGoingOnBatteries `
                                          -AllowStartIfOnBatteries `
                                          -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $nom -Action $action -Trigger $trigger `
                       -Settings $reglages -Description 'Ingestion quotidienne des offres JJ' `
                       -Force | Out-Null

Write-Host "Tache '$nom' installee : tous les jours a $Heure."
Write-Host "Test immediat        : Start-ScheduledTask -TaskName '$nom'"
Write-Host "Journaux             : $(Join-Path (Split-Path $PSScriptRoot -Parent) 'journaux')"
