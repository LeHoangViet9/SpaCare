import dns from 'node:dns';

// Opt-in for the local Atlas dev command. --import is inherited by Next workers;
// do not use --env-file here: Next loads .env.local itself.
if (process.env.VERCEL) throw new Error('Local DNS helper must not run on Vercel.');
dns.setServers(['1.1.1.1', '8.8.8.8']);
