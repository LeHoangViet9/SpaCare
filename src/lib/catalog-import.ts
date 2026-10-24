import mongoose from 'mongoose';
import { z } from 'zod';
import { Audit, Control, Idempotency, PackageTemplate, Service, User } from './models';
import { ensure } from './rules';
import { verifyPassword } from './password';
import { catalogEntryInput, catalogFingerprint, catalogNameKey, catalogRowKey, type CatalogEntry } from './catalog-import-plan';

export async function importCatalog(ownerId: string, password: string, raw: CatalogEntry[]) {
  const entries = z.array(catalogEntryInput).min(1).max(1000).parse(raw);
  ensure(new Set(entries.map(catalogRowKey)).size === entries.length, 'File có dịch vụ trùng.');
  // The caller supplies an account ID, never a spa ID; scope and role come from the database.
  return mongoose.connection.transaction(async session => {
    const owner = await User.findOne({ _id: ownerId, active: true, role: 'OWNER' }).select('+passwordHash').session(session);
    ensure(owner && verifyPassword(password, owner.passwordHash), 'Tài khoản chủ spa hoặc mật khẩu không đúng.', 403);
    const scope = { spaId: owner.spaId };
    const control = await Control.findOneAndUpdate(scope, { $inc: { revision: 1 } }, { session, returnDocument: 'after' });
    ensure(control, 'Cần chạy db:setup trước.', 503);
    const services = await Service.find(scope).session(session);
    const packages = await PackageTemplate.find(scope).session(session);
    let createdServices = 0, createdPackages = 0, skipped = 0;
    for (const entry of entries) {
      const key = catalogRowKey(entry), fingerprint = catalogFingerprint(entry);
      const previous = await Idempotency.findOne({ ...scope, key }).session(session);
      if (previous) {
        ensure(previous.fingerprint === fingerprint, `Dòng ${entry.row}: đã nhập trước đó với nội dung khác. Sửa trong danh mục, không ghi đè bằng import.`, 409);
        skipped++; continue;
      }
      const matches = services.filter(service => catalogNameKey(service.name || '') === catalogNameKey(entry.service.name)
        && catalogNameKey(service.category || '') === catalogNameKey(entry.service.category));
      ensure(matches.length <= 1, `Dòng ${entry.row}: danh mục có tên trùng, cần đối chiếu trước.`, 409);
      let service = matches[0];
      const serviceCreated = !service;
      if (service) ensure(service.active && service.price === entry.service.price && (service.commission || 0) === entry.service.commission,
        `Dòng ${entry.row}: dịch vụ có sẵn khác giá/hoa hồng hoặc đã ngừng. Không ghi đè.`, 409);
      else {
        [service] = await Service.create([{ ...scope, ...entry.service }], { session });
        services.push(service); createdServices++;
      }
      let plan;
      let packageCreated = false;
      if (entry.package) {
        const matching = packages.filter(value => catalogNameKey(value.name) === catalogNameKey(entry.package!.name));
        ensure(matching.length <= 1, `Dòng ${entry.row}: tên gói đã trùng.`, 409);
        plan = matching[0];
        if (plan) ensure(plan.active && String(plan.serviceId) === String(service._id) && plan.price === entry.package.price
          && plan.packageType === 'TIME' && plan.durationMonths === 36, `Dòng ${entry.row}: gói có sẵn khác quyền lợi/giá. Không ghi đè.`, 409);
        else {
          [plan] = await PackageTemplate.create([{ ...scope, ...entry.package, serviceId: service._id }], { session });
          packages.push(plan); createdPackages++; packageCreated = true;
        }
      }
      const result = { serviceId: String(service._id), ...(plan ? { packageTemplateId: String(plan._id) } : {}) };
      await Audit.create([{ ...scope, actorId: owner._id, action: 'importCatalog', targetId: service._id,
        details: { row: entry.row, source: entry.source, after: entry.service, ...result, serviceCreated, packageCreated } }], { session });
      await Idempotency.create([{ ...scope, userId: owner._id, key, fingerprint, result }], { session });
      if (!serviceCreated && !packageCreated) skipped++;
    }
    return { createdServices, createdPackages, skipped };
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
}
