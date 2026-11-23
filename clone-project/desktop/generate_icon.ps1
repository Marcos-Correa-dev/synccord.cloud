Add-Type -AssemblyName System.Drawing

function Create-ScdBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = [int]($size * 0.22)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2

    # Rounded rectangle
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d - 1, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d - 1, $size - $d - 1, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d - 1, $d, $d, 90, 90)
    $path.CloseFigure()

    # Discord / SyncCord Purple Gradient: #6e7bff (top-left) to #5865F2 (bottom-right)
    $cTop = [System.Drawing.Color]::FromArgb(255, 110, 123, 255)
    $cBot = [System.Drawing.Color]::FromArgb(255, 88, 101, 242)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBot, 45.0)
    $g.FillPath($brush, $path)

    # Subtle border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 1.0)
    $g.DrawPath($pen, $path)

    # Draw "SCD" branding
    $fontSize = [float]($size * 0.32)
    $fontFamily = New-Object System.Drawing.FontFamily("Arial Black")
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $yOffset = [float]($size * 0.02)
    $textRect = New-Object System.Drawing.RectangleF(0.0, $yOffset, [float]$size, [float]$size)
    $g.DrawString("SCD", $font, $textBrush, $textRect, $format)

    $g.Dispose()
    return $bmp
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytesList = @()

foreach ($s in $sizes) {
    $bmp = Create-ScdBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,$ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
}

$icoMs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($icoMs)

# ICO Header
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # ICO type
$bw.Write([uint16]$sizes.Count) # Count of images

$offset = 6 + ($sizes.Count * 16)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $data = $pngBytesList[$i]
    $w = if ($s -ge 256) { 0 } else { [byte]$s }
    $h = if ($s -ge 256) { 0 } else { [byte]$s }

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0) # Palette
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Planes
    $bw.Write([uint16]32) # BPP
    $bw.Write([uint32]$data.Length) # Size
    $bw.Write([uint32]$offset) # Offset

    $offset += $data.Length
}

foreach ($data in $pngBytesList) {
    $bw.Write($data)
}

$bw.Flush()
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$destPath = Join-Path $scriptDir "app.ico"
[System.IO.File]::WriteAllBytes($destPath, $icoMs.ToArray())
$bw.Dispose()
$icoMs.Dispose()

Write-Host "Generated $destPath with size: $((Get-Item $destPath).Length) bytes"
