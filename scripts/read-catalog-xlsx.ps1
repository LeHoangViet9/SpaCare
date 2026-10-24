param([Parameter(Mandatory=$true)][string]$FilePath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = $null
try {
  if ((Get-Item -LiteralPath $FilePath).Length -gt 10485760) { throw 'File exceeds 10 MB' }
  $archive = [System.IO.Compression.ZipFile]::OpenRead($FilePath)
  function Read-XmlEntry([string]$name) {
    $entry = $archive.GetEntry($name)
    if (!$entry -or $entry.Length -gt 10485760) { throw 'Missing or oversized XLSX entry' }
    $stream = $entry.Open()
    $settings = [System.Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create($stream, $settings)
    try { $document = [System.Xml.XmlDocument]::new(); $document.XmlResolver = $null; $document.Load($reader); return ,$document }
    finally { $reader.Dispose(); $stream.Dispose() }
  }
  $book = Read-XmlEntry 'xl/workbook.xml'
  $sheet = $book.SelectSingleNode('//*[local-name()="sheet"]')
  if (!$sheet) { throw 'No worksheet' }
  $relationId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $relations = Read-XmlEntry 'xl/_rels/workbook.xml.rels'
  $relation = @($relations.SelectNodes('//*[local-name()="Relationship"]') | Where-Object { $_.GetAttribute('Id') -eq $relationId })
  if ($relation.Count -ne 1 -or $relation[0].GetAttribute('TargetMode') -eq 'External') { throw 'Invalid worksheet relation' }
  $target = $relation[0].GetAttribute('Target')
  if ($target.Contains('..') -or $target.Contains('\')) { throw 'Invalid worksheet path' }
  if ($target.StartsWith('/')) { $sheetPath = $target.TrimStart('/') } else { $sheetPath = 'xl/' + $target }
  $strings = [System.Collections.Generic.List[string]]::new()
  if ($archive.GetEntry('xl/sharedStrings.xml')) {
    $shared = Read-XmlEntry 'xl/sharedStrings.xml'
    foreach ($item in $shared.SelectNodes('//*[local-name()="si"]')) {
      $strings.Add((@($item.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join ''))
    }
  }
  $worksheet = Read-XmlEntry $sheetPath
  $result = [System.Collections.Generic.List[object]]::new()
  foreach ($row in $worksheet.SelectNodes('//*[local-name()="sheetData"]/*[local-name()="row"]')) {
    if ($result.Count -ge 1001) { throw 'Maximum 1000 data rows' }
    $values = @{}
    foreach ($cell in $row.SelectNodes('./*[local-name()="c"]')) {
      if ($cell.SelectSingleNode('./*[local-name()="f"]')) { throw 'Formulas are not accepted; paste values first' }
      $reference = $cell.GetAttribute('r')
      if ($reference -notmatch '^([A-Z]+)[0-9]+$') { throw 'Invalid cell reference' }
      $column = $Matches[1]
      $value = $cell.SelectSingleNode('./*[local-name()="v"]')
      $type = $cell.GetAttribute('t')
      if ($type -eq 's') {
        $index = [int]$value.InnerText
        if ($index -lt 0 -or $index -ge $strings.Count) { throw 'Invalid shared string' }
        $values[$column] = $strings[$index]
      } elseif ($type -eq 'inlineStr') {
        $values[$column] = (@($cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '')
      } elseif ($value) { $values[$column] = $value.InnerText }
    }
    if ($values.Count) { $result.Add([pscustomobject]@{ row = [int]$row.GetAttribute('r'); cells = $values }) }
  }
  ConvertTo-Json -InputObject @($result.ToArray()) -Depth 5 -Compress
} catch {
  [Console]::Error.WriteLine('Khong doc duoc XLSX. Kiem tra file .xlsx, toi da 1000 dong/10MB, khong dung cong thuc.')
  exit 1
} finally { if ($archive) { $archive.Dispose() } }
