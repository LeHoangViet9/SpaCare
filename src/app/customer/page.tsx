import { redirect } from 'next/navigation';
import PublicHeader from '@/components/public-header';
import PublicFooter from '@/components/public-footer';
import CustomerDashboardClient from '@/components/customer-dashboard';
import { actor } from '@/lib/auth';
import { connect } from '@/lib/db';
import { Appointment, Customer, Invoice, Service, Treatment } from '@/lib/models';

export const dynamic = 'force-dynamic';

export default async function CustomerDashboardPage() {
  let user;
  try {
    user = await actor();
  } catch {
    redirect('/login?returnTo=/customer');
  }

  await connect();

  // Find customerId for this user
  let customerId = user.customerId;
  let customerName = user.name;

  if (!customerId) {
    const customer = await Customer.findOne({
      spaId: user.spaId,
      $or: [{ name: user.name }],
    }).lean();
    if (customer) {
      customerId = String(customer._id);
      customerName = customer.name;
    }
  }

  let appointments: any[] = [];
  let treatments: any[] = [];
  let invoices: any[] = [];

  if (customerId) {
    // 1. Appointments of this customer
    const rawAppointments = await Appointment.find({
      spaId: user.spaId,
      customerId,
    })
      .sort({ startAt: -1 })
      .lean();

    // Map service names
    const serviceIds = rawAppointments.map(a => a.serviceId);
    const services = await Service.find({ _id: { $in: serviceIds } })
      .select('_id name')
      .lean();
    const serviceMap = new Map(services.map(s => [String(s._id), s.name]));

    appointments = rawAppointments.map(a => ({
      _id: String(a._id),
      serviceName: serviceMap.get(String(a.serviceId)) || 'Dịch vụ spa',
      startAt: a.startAt ? new Date(a.startAt).toISOString() : '',
      endAt: a.endAt ? new Date(a.endAt).toISOString() : '',
      status: a.status || 'CONFIRMED',
      notes: a.notes || '',
    }));

    // 2. Treatments of this customer (excluding internal gifts details, etc.)
    const rawTreatments = await Treatment.find({
      spaId: user.spaId,
      customerId,
    })
      .select('_id name totalSessions remaining status packageType durationMonths startsOn expiresOn usedSessions')
      .sort({ createdAt: -1 })
      .lean();

    treatments = rawTreatments.map(t => ({
      _id: String(t._id),
      name: t.name,
      totalSessions: t.totalSessions,
      remaining: t.remaining,
      packageType: t.packageType, durationMonths: t.durationMonths, startsOn: t.startsOn, expiresOn: t.expiresOn, usedSessions: t.usedSessions,
      status: t.status,
    }));

    // 3. Invoices of this customer (excluding internal commission, consultant, etc.)
    const rawInvoices = await Invoice.find({
      spaId: user.spaId,
      customerId,
    })
      .select('_id description total paid status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    invoices = rawInvoices.map(i => ({
      _id: String(i._id),
      description: i.description || 'Hóa đơn dịch vụ',
      total: i.total || 0,
      paid: i.paid || 0,
      status: i.status || 'PENDING',
      createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : '',
    }));
  }

  return (
    <div className="pub-page-wrapper">
      <PublicHeader user={user} />

      <main className="pub-main" style={{ padding: '36px 0 80px 0' }}>
        <div className="pub-container" style={{ maxWidth: '960px' }}>
          <CustomerDashboardClient
            user={user}
            customerName={customerName}
            appointments={appointments}
            treatments={treatments}
            invoices={invoices}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
