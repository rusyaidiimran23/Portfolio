# Rebuild the portfolio's project photos from the drop folders in .\photos\
#
#   photos\<project-id>\1 - Lead photo caption.jpg     <- first file = big lead photo
#   photos\<project-id>\2 - Another caption.jpg
#   photos\<project-id>\3 - Dashboard.png              <- .png (screenshots) or "diagram" in the name = shown whole, not cropped
#
# Each image gets a frame on the site: photos = taped print, wide screenshots =
# app window, tall screenshots = phone. Override with a tag in the file name:
#   "3 - The edge camera unit [print].png"   ([print] / [phone] / [window])
#
# The number sets the order, the rest of the file name becomes the caption.
# The site shows the first 3 per project. Accepts .jpg, .jpeg and .png.
# Output: port_frontend\public\work\<id>\NN.jpg (+ NN-t.jpg thumbnails) and
# port_frontend\public\work\photos.json, which the site reads.
# Every image is re-encoded, so GPS/camera metadata is stripped.
#
# Run from this folder:   .\update-photos.ps1

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'photos'
$out  = Join-Path $root 'port_frontend\public\work'
New-Item -ItemType Directory -Force $out | Out-Null

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$quality = New-Object System.Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82L

function Save-Resized($img, $maxEdge, $path) {
  $scale = [Math]::Min(1.0, $maxEdge / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap $w, $h      # fresh bitmap: no EXIF/GPS carried over
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose()
  $bmp.Save($path, $jpeg, $quality); $bmp.Dispose()
}

$manifest = [ordered]@{}
foreach ($dir in Get-ChildItem $src -Directory | Sort-Object Name) {
  $id = $dir.Name.ToLower()
  $dest = Join-Path $out $id
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }   # rebuild from scratch
  New-Item -ItemType Directory -Force $dest | Out-Null

  $files = Get-ChildItem $dir.FullName -File |
    Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } |
    Sort-Object { if ($_.BaseName -match '^\s*(\d+)') { [int]$matches[1] } else { 9999 } }, Name

  $list = New-Object System.Collections.ArrayList
  $i = 0
  foreach ($f in $files) {
    $i++
    $n = '{0:D2}' -f $i
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    if ($img.PropertyIdList -contains 0x0112) {              # honour phone/camera rotation
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) {
        3 { $img.RotateFlip('Rotate180FlipNone') }
        6 { $img.RotateFlip('Rotate90FlipNone') }
        8 { $img.RotateFlip('Rotate270FlipNone') }
      }
    }
    Save-Resized $img 1600 (Join-Path $dest "$n.jpg")
    Save-Resized $img 480  (Join-Path $dest "$n-t.jpg")
    $w = $img.Width; $h = $img.Height
    $img.Dispose()

    # optional frame tag in the file name: [print] [phone] [window] (stripped from the caption)
    $frame = if ($f.BaseName -match '(?i)\[(print|phone|window)\]') { $matches[1].ToLower() } else { '' }
    $caption = (($f.BaseName -replace '\s*\[[^\]]*\]', '') -replace '^\s*\d+\s*[-_.)]*\s*', '').Trim()
    # screenshots (.png) and diagrams are shown whole; camera photos fill and crop
    $fit = if ($f.Extension -eq '.png' -or $f.BaseName -match '(?i)diagram|screenshot') { 'contain' } else { 'cover' }
    [void]$list.Add([ordered]@{ src = "/work/$id/$n.jpg"; caption = $caption; fit = $fit; w = $w; h = $h; frame = $frame })
  }
  if ($list.Count) { $manifest[$id] = $list }
  Write-Output ("{0,-8} {1} photo(s)" -f $id, $list.Count)
}

# drop output folders whose drop folder no longer exists
Get-ChildItem $out -Directory | Where-Object { -not (Test-Path (Join-Path $src $_.Name)) } | Remove-Item -Recurse -Force

$json = ConvertTo-Json -InputObject $manifest -Depth 5
[IO.File]::WriteAllText((Join-Path $out 'photos.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Output "Done -> port_frontend\public\work\photos.json (reload the site to see changes)"
