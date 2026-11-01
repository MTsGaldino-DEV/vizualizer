# Registra o worker-ia para iniciar quando o Matheus fizer logon (tarefa do usuário, sem admin).
# Rodar manualmente:  powershell -ExecutionPolicy Bypass -File scripts\worker-ia-tarefa.ps1
# Remover:            Unregister-ScheduledTask -TaskName "Vizualizer worker-ia" -Confirm:$false
$raiz = Split-Path -Parent $PSScriptRoot
$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -Command `"cd '$raiz\apps\worker-ia'; corepack pnpm start *>> '$raiz\scripts\saida\worker-ia.log'`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$config = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "Vizualizer worker-ia" -Action $acao -Trigger $gatilho -Settings $config -Description "Resumo de vídeos com IA local (Vizualizer)"
