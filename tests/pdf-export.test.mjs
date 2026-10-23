import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { imagePdf } from '../src/lib/pdf-bytes.ts';
test('PDF stores binary image lengths and valid byte offsets for multiple pages', () => {
  const jpeg = Uint8Array.from([255,216,0,128,10,255,217]);
  const bytes = Buffer.from(imagePdf([{jpeg,width:1240,height:1754},{jpeg,width:1240,height:1754}]));
  const text = bytes.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\/Count 2/);
  const start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(start,start+4),'xref');
  const entries = text.slice(start).split('\n').slice(3,11);
  entries.forEach((entry,index) => assert.ok(text.slice(Number(entry.slice(0,10))).startsWith(`${index+1} 0 obj\n`)));
  for (const match of text.matchAll(/\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g)) {
    assert.equal(Number(match[1]),jpeg.length);
    assert.deepEqual(bytes.subarray(match.index+match[0].length,match.index+match[0].length+jpeg.length),Buffer.from(jpeg));
  }
  assert.throws(()=>imagePdf([]));
});
test('commission export scopes all month rows, preserves negative adjustments and separates totals', () => {
  execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./pdf-export-fixture.ts',import.meta.url))],{env:{...process.env,MONGODB_URI:''},stdio:'pipe',timeout:15000});
});
