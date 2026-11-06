# ============================================
# Fix localStorage identity reads
# Run from the js folder
# ============================================

# Files to patch (exclude bundle.js — handle separately)
$files = @(
    'mobile.js', 'navbar.js', 'upadte.js', 'VC.JS',
    'businessLogic.js', 'daily-dashboard.js', 'edititem.js',
    'events.js', 'realtime-connections.js', '01.js'
)

# License key replacements
$licenseReplacements = @{
    "localStorage\.getItem\('licensePlan'\)"     = "window.businessInfo?.license_plan"
    "localStorage\.getItem\('licenseStatus'\)"   = "window.businessInfo?.license_status"
    "localStorage\.getItem\('licenseExpires'\)"  = "window.businessInfo?.license_expires_at"
}

# Identity key replacements
$identityReplacements = @{
    "localStorage\.getItem\('currentUsername'\)" = "window.currentUser?.username"
    "localStorage\.getItem\('currentRole'\)"     = "window.currentUser?.role"
    "localStorage\.getItem\('currentUserId'\)"   = "window.currentUser?.id"
    "localStorage\.getItem\('businessId'\)"      = "window.currentUser?.business_id"
    "localStorage\.getItem\('userEmail'\)"       = "window.currentUser?.email"
}

$all = $licenseReplacements + $identityReplacements

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "⏭️  Skipping $file (not found)" -ForegroundColor Yellow
        continue
    }

    # Backup
    Copy-Item $file "$file.bak" -Force

    $content = Get-Content $file -Raw
    $original = $content

    foreach ($pattern in $all.Keys) {
        $replacement = $all[$pattern]
        $content = $content -replace $pattern, $replacement
    }

    if ($content -ne $original) {
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "✅ Patched $file" -ForegroundColor Green
    } else {
        Write-Host "➖ No changes needed in $file" -ForegroundColor Gray
        Remove-Item "$file.bak" -Force
    }
}

Write-Host ""
Write-Host "Done. Check .bak files for backups. Test the app, then delete the .bak files." -ForegroundColor Cyan