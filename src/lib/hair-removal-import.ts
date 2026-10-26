import { z } from 'zod';
import { readPrivateImportJson } from './private-import-input';
import { DomainError } from './rules';
const aliasSchema=z.array(z.object({phone:z.string().regex(/^0[0-9]{9,10}$/),
  source:z.string().min(1).max(200),existing:z.string().min(1).max(200)}).strict()).max(1000);
export type ConfirmedAlias=z.infer<typeof aliasSchema>[number];
export function readConfirmedAliases(file:string):ConfirmedAlias[] {
  try {
    const rows=aliasSchema.parse(readPrivateImportJson(file));
    if(new Set(rows.map(row=>JSON.stringify([row.phone,row.source.normalize('NFC')]))).size!==rows.length) throw Error();
    return rows;
  } catch {throw new DomainError('File ánh xạ không hợp lệ. Dùng JSON riêng trong imports.');}
}
// No built-in personal data. Both phone and exact NFC source name must match.
export function confirmedHairRemovalName(name:string,phone?:string,aliases:ConfirmedAlias[]=[]) {
  const alias=aliases.find(row=>row.phone===phone && row.source.normalize('NFC')===name.normalize('NFC'));
  return alias?.existing ?? name;
}
