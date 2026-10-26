import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

// Resolve before reading so traversal and links cannot escape ignored imports/.
export function readPrivateImportJson(file:string):unknown {
  const root=realpathSync(resolve('imports'));
  const target=realpathSync(resolve(file));
  const local=relative(root,target);
  if(!local || local==='..' || local.startsWith('..\\') || local.startsWith('../') || isAbsolute(local) ||
    !target.toLowerCase().endsWith('.json') || !statSync(target).isFile() || statSync(target).size>65536) throw Error('PRIVATE_INPUT_INVALID');
  return JSON.parse(readFileSync(target,'utf8'));
}
