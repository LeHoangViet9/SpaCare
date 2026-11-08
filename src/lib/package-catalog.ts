type Row = Record<string, any>;

// PackageTemplate is the catalog boundary; services/products are never inferred
// to be packages from their names or categories.
export function saleablePackage(template:Row, service:Row|undefined){
  return !!template.active && !!service?.active && String(template.serviceId)===String(service._id);
}

export function saleablePackageTemplates<T extends Row>(templates:readonly T[],services:readonly Row[]):T[]{
  return templates.filter(template=>saleablePackage(template,services.find(service=>String(service._id)===String(template.serviceId))));
}
