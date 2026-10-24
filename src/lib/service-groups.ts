export function serviceGroupName(value:string) { return value.normalize('NFC').trim().replace(/\s+/g,' '); }
export function serviceGroupKey(value:string) { return serviceGroupName(value).toLocaleLowerCase('vi'); }
export function serviceGroupNames(groups: {name?:string}[], services:{category?:string}[], current='') {
  // Keep exact legacy category values selectable; do not silently rename old categories.
  return [...new Set([...groups.map(g=>g.name),...services.map(s=>s.category),current].filter((v):v is string=>typeof v==='string'&&!!v.trim()))].sort((a,b)=>a.localeCompare(b,'vi'));
}
export function selectableServices(services:Record<string,any>[], current='') {
  return services.filter(s=>s.active!==false || s._id===current);
}
