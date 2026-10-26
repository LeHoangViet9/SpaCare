import { readPrivateImportJson } from './private-import-input';
import { z } from 'zod';
import { openingExpiry, openingKey } from './opening-balances';
import { dayBounds, DomainError } from './rules';

const text=z.string().trim().min(1).max(200);
const schema=z.object({
  batch:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  source:z.object({name:text,phone:z.string().regex(/^0[0-9]{9,10}$/),
    startsOn:z.string(),expiresOn:z.string(),services:z.array(text).length(3)}).strict(),
}).strict();

// Only local, ignored inputs; never include parsed input or filesystem errors in logs.
export function readSupplementInput(file:string) {
  try {
    const input=schema.parse(readPrivateImportJson(file));
    dayBounds(input.source.startsOn);dayBounds(input.source.expiresOn);
    if(input.source.expiresOn!==openingExpiry(input.source.startsOn,36) ||
      new Set(input.source.services.map(openingKey)).size!==3) throw Error();
    return input;
  } catch { throw new DomainError('File bổ sung không hợp lệ. Dùng JSON riêng trong imports, đúng 3 dịch vụ và thời hạn 36 tháng.'); }
}
