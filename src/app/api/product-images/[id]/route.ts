import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { connect } from '@/lib/db';
import { failure } from '@/lib/http';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return new Response(null, { status: 404 });
    await connect();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'product_images' });
    const objectId = new mongoose.Types.ObjectId(id);
    const file = await bucket.find({ _id: objectId, 'metadata.kind': 'PRODUCT_IMAGE' }).next();
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.metadata?.contentType)) return new Response(null, { status: 404 });
    const stream = Readable.toWeb(bucket.openDownloadStream(objectId)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: { 'Content-Type': file.metadata!.contentType,
      'Content-Length': String(file.length), 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch (error) { return failure(error); }
}
