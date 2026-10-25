// Exact customer aliases confirmed by the owner on 2026-10-25.
// Phone and source name must both match. General customer matching stays strict.
const confirmedAliases = [
  { phone: '0366575893', source: 'H\u01b0\u01a1ng Lan Kim Lan', existing: 'H\u01b0\u01a1ng Lan KL' },
  { phone: '0973425688', source: 'Ch\u1ecb Ng\u1ea7n X3', existing: 'C Ng\u1ea7n x3' },
  { phone: '0399319594', source: 'Ho\u00e0i Thu V\u0103n \u0110\u1ee9c', existing: 'Ho\u00e0i Thu' },
];
export function confirmedHairRemovalName(name: string, phone?: string) {
  const alias = confirmedAliases.find(row => row.phone === phone && row.source.normalize('NFC') === name.normalize('NFC'));
  return alias?.existing ?? name;
}
