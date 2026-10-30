import type { ClientSession } from 'mongoose';
import { Payroll } from './models';

type TenantScope = { spaId: unknown; staffId?: unknown };
type CommissionLedgerName = 'commission' | 'invoiceLineCommission' | 'saleCommission' | 'sharedSaleCommission';
type CommissionRows = Record<CommissionLedgerName, Array<{ _id: unknown; payrollId?: unknown }>>;

// Legacy approved payrolls may hold InvoiceLineCommission IDs in commissionIds
// without backfilling payrollId on the ledger row. Keep that immutable history
// authoritative without mutating old payroll or commission documents.
export async function legacySettledCommissionLedgerIds(
  scope: TenantScope,
  candidates: Partial<Record<CommissionLedgerName, unknown[]>>,
  session: ClientSession,
): Promise<Record<CommissionLedgerName, Set<string>>> {
  const rawIds: Record<CommissionLedgerName, unknown[]> = {
    commission: (candidates.commission || []).filter(Boolean),
    invoiceLineCommission: (candidates.invoiceLineCommission || []).filter(Boolean),
    saleCommission: (candidates.saleCommission || []).filter(Boolean),
    sharedSaleCommission: (candidates.sharedSaleCommission || []).filter(Boolean),
  };
  const ids: Record<CommissionLedgerName, string[]> = {
    commission: rawIds.commission.map(String),
    invoiceLineCommission: rawIds.invoiceLineCommission.map(String),
    saleCommission: rawIds.saleCommission.map(String),
    sharedSaleCommission: rawIds.sharedSaleCommission.map(String),
  };
  const clauses: Record<string, unknown>[] = [];
  if (rawIds.commission.length) clauses.push({ commissionIds: { $in: rawIds.commission } });
  if (rawIds.invoiceLineCommission.length) clauses.push(
    { commissionIds: { $in: rawIds.invoiceLineCommission } },
    { invoiceLineCommissionIds: { $in: rawIds.invoiceLineCommission } },
  );
  if (rawIds.saleCommission.length) clauses.push({ saleCommissionIds: { $in: rawIds.saleCommission } });
  if (rawIds.sharedSaleCommission.length) clauses.push({ sharedSaleCommissionIds: { $in: rawIds.sharedSaleCommission } });

  const settled: Record<CommissionLedgerName, Set<string>> = {
    commission: new Set(),
    invoiceLineCommission: new Set(),
    saleCommission: new Set(),
    sharedSaleCommission: new Set(),
  };
  if (!clauses.length) return settled;

  const payrolls = await Payroll.find({ ...scope, status: { $in: ['APPROVED', 'PAID'] }, $or: clauses })
    .select('commissionIds invoiceLineCommissionIds saleCommissionIds sharedSaleCommissionIds')
    .session(session)
    .lean();
  for (const payroll of payrolls) {
    for (const id of payroll.commissionIds || []) {
      const value = String(id);
      if (ids.commission.includes(value)) settled.commission.add(value);
      if (ids.invoiceLineCommission.includes(value)) settled.invoiceLineCommission.add(value);
    }
    for (const id of payroll.invoiceLineCommissionIds || []) {
      const value = String(id);
      if (ids.invoiceLineCommission.includes(value)) settled.invoiceLineCommission.add(value);
    }
    for (const id of payroll.saleCommissionIds || []) {
      const value = String(id);
      if (ids.saleCommission.includes(value)) settled.saleCommission.add(value);
    }
    for (const id of payroll.sharedSaleCommissionIds || []) {
      const value = String(id);
      if (ids.sharedSaleCommission.includes(value)) settled.sharedSaleCommission.add(value);
    }
  }
  return settled;
}

export async function legacySettledInvoiceLineIds(
  scope: TenantScope,
  candidateIds: unknown[] = [],
  session?: ClientSession,
): Promise<Set<string>> {
  const ids = candidateIds.filter(Boolean);
  const filter: Record<string, unknown> = {
    ...scope,
    status: { $in: ['APPROVED', 'PAID'] },
    ...(ids.length ? { $or: [{ commissionIds: { $in: ids } }, { invoiceLineCommissionIds: { $in: ids } }] } : {}),
  };
  let query = Payroll.find(filter).select('commissionIds invoiceLineCommissionIds');
  if (session) query = query.session(session);
  const payrolls = await query.lean();
  const settled = new Set<string>();
  for (const payroll of payrolls) {
    for (const id of [...(payroll.commissionIds || []), ...(payroll.invoiceLineCommissionIds || [])]) {
      const value = String(id);
      if (!ids.length || ids.some(candidate => String(candidate) === value)) settled.add(value);
    }
  }
  return settled;
}

export async function hasSettledInvoiceLineCommission(
  scope: TenantScope,
  rows: Array<{ _id: unknown; payrollId?: unknown }>,
  session: ClientSession,
): Promise<boolean> {
  if (rows.some(row => row.payrollId)) return true;
  if (!rows.length) return false;
  return (await legacySettledInvoiceLineIds(scope, rows.map(row => row._id), session)).size > 0;
}

export async function hasSettledCommissionLedgers(
  scope: TenantScope,
  rows: CommissionRows,
  session: ClientSession,
): Promise<boolean> {
  if (Object.values(rows).some(ledgerRows => ledgerRows.some(row => row.payrollId))) return true;
  const settled = await legacySettledCommissionLedgerIds(
    scope,
    Object.fromEntries(Object.entries(rows).map(([name, ledgerRows]) => [name, ledgerRows.map(row => row._id)])) as Partial<Record<CommissionLedgerName, unknown[]>>,
    session,
  );
  return Object.values(settled).some(ids => ids.size > 0);
}
