Write-Host "=== 当前 Documents 文件夹指向 ==="
$personal = Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Personal -ErrorAction SilentlyContinue
Write-Host "Documents: $personal"

Write-Host ""
Write-Host "=== 当前 Desktop 文件夹指向 ==="
$desktop = Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Desktop -ErrorAction SilentlyContinue
Write-Host "Desktop: $desktop"

Write-Host ""
Write-Host "=== 新目标路径 (移回本地) ==="
$newDocs = "C:\Users\kukat\Documents"
$newDesktop = "C:\Users\kukat\Desktop"
Write-Host "新 Documents: $newDocs"
Write-Host "新 Desktop: $newDesktop"

Write-Host ""
Write-Host "⚠️  下面将执行修改操作，按回车继续，Ctrl+C 取消"
pause

# 创建目标文件夹（如果不存在）
if (-not (Test-Path $newDocs)) { New-Item -Path $newDocs -ItemType Directory -Force | Out-Null }
if (-not (Test-Path $newDesktop)) { New-Item -Path $newDesktop -ItemType Directory -Force | Out-Null }

Write-Host ""
Write-Host "=== 复制文件从 OneDrive 到本地 ==="
Write-Host "复制 Documents..."
$oneDriveDocs = $personal
if ($oneDriveDocs -and (Test-Path $oneDriveDocs)) {
    Robocopy $oneDriveDocs $newDocs /E /MOV /R:2 /W:3 /NFL /NDL
} else { Write-Host "  源路径无效，跳过" }

Write-Host ""
Write-Host "复制 Desktop..."
$oneDriveDesktop = $desktop
if ($oneDriveDesktop -and (Test-Path $oneDriveDesktop)) {
    Robocopy $oneDriveDesktop $newDesktop /E /MOV /R:2 /W:3 /NFL /NDL
} else { Write-Host "  源路径无效，跳过" }

Write-Host ""
Write-Host "=== 修改注册表，将文件夹指向本地 ==="
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Personal -Value $newDocs
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Desktop -Value $newDesktop
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" -Name Personal -Value $newDocs -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" -Name Desktop -Value $newDesktop -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ 完成！"
Write-Host "Documents 和 Desktop 已移回 C 盘。"
Write-Host "请重启电脑使所有程序识别新路径。"
Write-Host ""
Write-Host "你的数学网站项目路径是：C:\Users\kukat\Projects\math-platform"
Write-Host "完全不受影响，随时可以继续开发。"
