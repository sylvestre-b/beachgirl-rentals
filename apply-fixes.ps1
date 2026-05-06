# ============================================================
# apply-fixes.ps1 — Beach Girl Rentals 2026-05 fix-pass (round 2)
# ============================================================
# Run from the repo root:
#   cd C:\Users\Bradley J Sylvestre\Desktop\Projects\beachgirl-rentals
#   .\apply-fixes.ps1
# ============================================================

$ErrorActionPreference = 'Continue'

function Write-Step([string]$msg)    { Write-Host $msg -ForegroundColor Cyan }
function Write-OK  ([string]$msg)    { Write-Host "   OK  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)    { Write-Host "   --  $msg" -ForegroundColor Yellow }
function Write-Err ([string]$msg)    { Write-Host "   !!  $msg" -ForegroundColor Red }

# ── 0. Sanity: are we in the repo root? ──────────────────────
if (-not (Test-Path "index.html") -or -not (Test-Path "js")) {
    Write-Err "This doesn't look like the beachgirl-rentals repo root."
    Write-Err "Expected to find index.html and js\ here."
    exit 1
}

# ── 1. Locate fix-pack ───────────────────────────────────────
$fixPack = Join-Path $PSScriptRoot "fix-pack"
if (-not (Test-Path $fixPack)) {
    Write-Err "fix-pack folder not found at: $fixPack"
    Write-Err "Drop the fix-pack folder next to apply-fixes.ps1 and rerun."
    exit 1
}

# ── 2. Backup originals ──────────────────────────────────────
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".\_backup-$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Step ""
Write-Step "Backing up originals to $backupDir"

$filesToBackup = @(
    "styles\extras.css",
    "js\listings.js",
    "js\forms.js",
    "js\property.js",
    "translations\en.json",
    "translations\fr.json",
    "icons\tag-icons.svg",
    "index.html",
    "property.html",
    "reviews.html",
    "blog.html"
)
$backedUp = 0
foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $dest = Join-Path $backupDir $file
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        }
        Copy-Item $file $dest -Force
        $backedUp++
    }
}
Write-OK "Backed up $backedUp files"

# ── 3. Copy fix-pack files ───────────────────────────────────
Write-Step ""
Write-Step "Copying new files into place"

$copyMap = @{
    "styles\extras.css"     = "styles\extras.css"
    "js\listings.js"        = "js\listings.js"
    "js\forms.js"           = "js\forms.js"
    "js\property.js"        = "js\property.js"
    "translations\en.json"  = "translations\en.json"
    "translations\fr.json"  = "translations\fr.json"
    "icons\tag-icons.svg"   = "icons\tag-icons.svg"
}

foreach ($srcRel in $copyMap.Keys) {
    $srcPath  = Join-Path $fixPack $srcRel
    $destPath = $copyMap[$srcRel]
    if (-not (Test-Path $srcPath)) {
        Write-Err "MISSING in fix-pack: $srcRel"
        continue
    }
    $destDir = Split-Path $destPath -Parent
    if ($destDir -and -not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    Copy-Item $srcPath $destPath -Force
    Write-OK $destPath
}

# ── 4. Helper: simple literal find-and-replace on a file ─────
function Replace-InFile {
    param(
        [string]$File,
        [string]$Find,
        [string]$Replace,
        [string]$What
    )
    if (-not (Test-Path $File)) {
        Write-Warn "$File not found, skipping: $What"
        return
    }
    $content = [System.IO.File]::ReadAllText((Resolve-Path $File).Path)
    if ($content.IndexOf($Find) -lt 0) {
        Write-Warn "$File - target not found for: $What (might already be patched)"
        return
    }
    $newContent = $content.Replace($Find, $Replace)
    [System.IO.File]::WriteAllText((Resolve-Path $File).Path, $newContent)
    Write-OK "$File - $What"
}

# ── Helper: regex replace with content from a file ──────────
# Uses .NET regex directly (avoids PowerShell -replace's quirks with $ in replacement strings).
function Replace-ScriptBlock {
    param(
        [string]$File,
        [string]$RegexPattern,
        [string]$ReplacementFile,
        [string]$AlreadyPatchedMarker,
        [string]$What
    )
    if (-not (Test-Path $File)) {
        Write-Warn "$File not found, skipping: $What"
        return
    }
    if (-not (Test-Path $ReplacementFile)) {
        Write-Err "Replacement file missing: $ReplacementFile"
        return
    }

    $absFile = (Resolve-Path $File).Path
    $content = [System.IO.File]::ReadAllText($absFile)

    # Already patched? Marker is a unique snippet that only appears in the new code.
    if ($content.IndexOf($AlreadyPatchedMarker) -ge 0) {
        Write-OK "$File - already patched (skipping)"
        return
    }

    $replacement = [System.IO.File]::ReadAllText((Resolve-Path $ReplacementFile).Path)
    $regex = [System.Text.RegularExpressions.Regex]::new($RegexPattern, 'Singleline')

    if (-not $regex.IsMatch($content)) {
        Write-Warn "$File - script-block pattern didn't match. Manual review needed."
        Write-Warn "        Original is in $backupDir"
        return
    }

    # Replace once, using the string overload. We escape $ chars in the
    # replacement so .NET regex doesn't interpret them as group references.
    $escapedReplacement = $replacement.Replace('$', '$$')
    $newContent = $regex.Replace($content, $escapedReplacement, 1)

    [System.IO.File]::WriteAllText($absFile, $newContent)
    Write-OK "$File - $What"
}

# ── 5. Patch HTML files ──────────────────────────────────────
Write-Step ""
Write-Step "Patching HTML files"

# ── PATCH A: index.html — hero heading copy + non-breaking summer ──
Replace-InFile -File "index.html" `
    -Find  '<em data-i18n="hero.title_em">Maine summer</em><span data-i18n="hero.title_post">, no booking fees attached.</span>' `
    -Replace '<em data-i18n="hero.title_em" style="white-space:nowrap">Maine summer</em><span data-i18n="hero.title_post">, no hidden fees attached.</span>' `
    -What "hero heading: 'no hidden fees' + nowrap on summer"

# ── PATCH B: index.html — hero description copy ──
Replace-InFile -File "index.html" `
    -Find    "message Jill directly and you're one step closer" `
    -Replace "message the owner directly and you're one step closer" `
    -What    "hero copy: message the owner"

# ── PATCH C: property.html — 'message Jill' fallback copy ──
Replace-InFile -File "property.html" `
    -Find    "message Jill" `
    -Replace "message the owner" `
    -What    "property page: message the owner"

# ── PATCH D: reviews.html — replace whole inline script block ──
$reviewsRegex = '<script type="module">\s*import \{ loadAll, esc, renderStars \} from ''/js/data\.js'';.*?</script>'
$reviewsBlock = Join-Path $fixPack "_html-blocks\reviews-script.html"
Replace-ScriptBlock -File "reviews.html" `
    -RegexPattern $reviewsRegex `
    -ReplacementFile $reviewsBlock `
    -AlreadyPatchedMarker "function renderEmpty(grid)" `
    -What "bulletproof inline script (try/catch on render)"

# ── PATCH E: blog.html — replace whole inline script block ──
$blogRegex = '<script type="module">\s*import \{ loadAll, esc \} from ''/js/data\.js'';.*?</script>'
$blogBlock = Join-Path $fixPack "_html-blocks\blog-script.html"
Replace-ScriptBlock -File "blog.html" `
    -RegexPattern $blogRegex `
    -ReplacementFile $blogBlock `
    -AlreadyPatchedMarker "function renderEmpty(list)" `
    -What "bulletproof inline script (try/catch on render)"

# ── 6. Verify ────────────────────────────────────────────────
Write-Step ""
Write-Step "Verifying results"

$checks = @()

if (Test-Path "index.html") {
    $idx = [System.IO.File]::ReadAllText((Resolve-Path "index.html"))
    $checks += @{ Name = "index.html: 'no hidden fees'";       Pass = $idx.Contains("no hidden fees") }
    $checks += @{ Name = "index.html: nowrap on Maine summer"; Pass = $idx.Contains("white-space:nowrap") }
    $checks += @{ Name = "index.html: 'message the owner'";    Pass = $idx.Contains("message the owner directly") }
}

if (Test-Path "styles\extras.css") {
    $css = [System.IO.File]::ReadAllText((Resolve-Path "styles\extras.css"))
    $checks += @{ Name = "extras.css: card border fix";        Pass = $css.Contains("1.5px solid var(--driftwood-pale") }
    $checks += @{ Name = "extras.css: 10+ glyph fix";          Pass = $css.Contains("trust-icon--decade") }
    $checks += @{ Name = "extras.css: J/F font-feature fix";   Pass = $css.Contains("font-feature-settings") }
}

if (Test-Path "js\listings.js") {
    $ls = [System.IO.File]::ReadAllText((Resolve-Path "js\listings.js"))
    $checks += @{ Name = "listings.js: second-floor removed";  Pass = -not $ls.Contains("'second-floor':") }
    $checks += @{ Name = "listings.js: date-range filter";     Pass = $ls.Contains("matchesDateRange") }
    $checks += @{ Name = "listings.js: card-cta wrapper gone"; Pass = -not $ls.Contains('span class="card-cta"') }
}

if (Test-Path "translations\en.json") {
    $en = [System.IO.File]::ReadAllText((Resolve-Path "translations\en.json"))
    $checks += @{ Name = "en.json: 'no hidden fees'";          Pass = $en.Contains("no hidden fees") }
    $checks += @{ Name = "en.json: 'message the owner'";       Pass = $en.Contains("message the owner") }
    $checks += @{ Name = "en.json: filter_second_floor gone";  Pass = -not $en.Contains("filter_second_floor") }
}

if (Test-Path "reviews.html") {
    $rv = [System.IO.File]::ReadAllText((Resolve-Path "reviews.html"))
    $checks += @{ Name = "reviews.html: bulletproof script";   Pass = $rv.Contains("function renderEmpty(grid)") }
}

if (Test-Path "blog.html") {
    $bl = [System.IO.File]::ReadAllText((Resolve-Path "blog.html"))
    $checks += @{ Name = "blog.html: bulletproof script";      Pass = $bl.Contains("function renderEmpty(list)") }
}

$passCount = 0
$failCount = 0
foreach ($check in $checks) {
    if ($check.Pass) {
        Write-OK $check.Name
        $passCount++
    } else {
        Write-Err $check.Name
        $failCount++
    }
}

# ── 7. Summary ───────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================"
if ($failCount -eq 0) {
    Write-Host " DONE - $passCount of $passCount checks passed" -ForegroundColor Green
} else {
    Write-Host " PARTIAL - $passCount passed, $failCount failed" -ForegroundColor Yellow
    Write-Host " Originals are in: $backupDir" -ForegroundColor Yellow
    Write-Host " To roll back:    Copy-Item $backupDir\* . -Recurse -Force" -ForegroundColor DarkYellow
}
Write-Host "============================================================"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. npm run build         (regenerate listings-index.json etc.)"
Write-Host "  2. git diff              (review what changed)"
Write-Host "  3. git add -A; git commit -m 'fix: 2026-05 round 2'"
Write-Host "  4. git push              (Netlify will deploy)"
Write-Host "  5. Hard-refresh prod (Ctrl+F5) and walk through the home page."
Write-Host ""
