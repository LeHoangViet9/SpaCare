import mongoose from 'mongoose';

let pending: Promise<typeof mongoose> | undefined;

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Chưa cấu hình MONGODB_URI trong .env.local.');
  if (mongoose.connection.readyState === 1) return mongoose;
  pending ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000, autoIndex: false })
    .catch(e => {
      pending = undefined;
      throw e;
    });
  return pending;
}
