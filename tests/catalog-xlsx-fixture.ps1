param([string]$OutputFile, [switch]$Formula)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($OutputFile, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $formulaCell = if ($Formula) { '<f>1+1</f>' } else { '' }
  $parts = @{
    'xl/workbook.xml' = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Danh mục" sheetId="1" r:id="rId1" /></sheets></workbook>'
    'xl/_rels/workbook.xml.rels' = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" /></Relationships>'
    'xl/sharedStrings.xml' = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Hoa hồng (VNĐ)</t></si></sst>'
    'xl/worksheets/sheet1.xml' = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Tên dịch vụ</t></is></c><c r="E1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Triệt lông Nách</t></is></c><c r="E2">' + $formulaCell + '<v>0</v></c></row></sheetData></worksheet>'
  }
  foreach ($name in $parts.Keys) {
    $entry = $zip.CreateEntry($name)
    $writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $writer.Write($parts[$name]) } finally { $writer.Dispose() }
  }
} finally { $zip.Dispose() }
