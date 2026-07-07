Write-Output "=== 1. Documents 注册表指向 ==="
$docsReg = Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Personal
Write-Output "指向: $docsReg"

Write-Output "`n=== 2. Desktop 注册表指向 ==="
$deskReg = Get-ItemPropertyValue -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" -Name Desktop
Write-Output "指向: $deskReg"

Write-Output "`n=== 3. 本地 Documents 文件夹内容 ==="
$localDocs = "C:\Users\kukat\Documents"
if (Test-Path $localDocs) {
    $items = Get-ChildItem $localDocs -Force -ErrorAction SilentlyContinue
    Write-Output "文件/文件夹数量: $($items.Count)"
    $size = (Get-ChildItem $localDocs -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Output "总大小: $([math]::Round($size / 1MB, 2)) MB"
} else { Write-Output "❌ 不存在！" }

Write-Output "`n=== 4. OneDrive 里旧的 Documents 文件夹还有东西吗？ ==="
$oldDocs = "C:\Users\kukat\OneDrive\文件"
if (Test-Path $oldDocs) {
    $oldItems = Get-ChildItem $oldDocs -Force -ErrorAction SilentlyContinue
    Write-Output "还有 $($oldItems.Count) 个文件/文件夹残留"
    $oldSize = (Get-ChildItem $oldDocs -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Write-Output "残留大小: $([math]::Round($oldSize / 1MB, 2)) MB"
    if ($oldItems.Count -eq 0) { Write-Output "✅ 已经清空！" }
    else { Write-Output "⚠️ 还有残留（可能是一些被锁的文件）" }
} else { Write-Output "✅ 文件夹已不存在" }

Write-Output "`n=== 5. OneDrive 备份设置（是否还在备份文档/桌面） ==="
$backupKey = "HKCU:\Software\Microsoft\OneDrive\Accounts\Personal"
$backupFolders = Get-ItemProperty -Path $backupKey -Name "BackupFolder*" -ErrorAction SilentlyContinue
if ($backupFolders) {
    $props = $backupFolders.PSObject.Properties | Where-Object { $_.Name -like "BackupFolder*" }
    foreach ($p in $props) {
        $val = $p.Value -join ""
        if ($val -match "Personal|Desktop") { Write-Output "⚠️ 仍在备份: $val" }
    }
    if (-not ($props)) { Write-Output "✅ 已关闭备份" }
} else { Write-Output "✅ 已关闭备份" }

Write-Output "`n=== 6. 你的项目 ==="
if (Test-Path "C:\Users\kukat\Projects\math-platform") { Write-Output "✅ 项目安全（路径: C:\Users\kukat\Projects\math-platform）" }

Write-Output "`n=== 7. 检查 Documents 里的关键文件（验证复制是否成功） ==="
$testFiles = @("xwechat_files", "WeChat Files")
foreach ($f in $testFiles) {
    $path = Join-Path $localDocs $f
    if (Test-Path $path) { Write-Output "✅ $f 已成功复制到本地" }
}
$items = Get-ChildItem $localDocs -Force -ErrorAction SilentlyContinue | Select-Object -First 10 -ExpandProperty Name
Write-Output "本地 Documents 前 10 个项目:"
$items | ForEach-Object { Write-Output ("   - " + $_) }
