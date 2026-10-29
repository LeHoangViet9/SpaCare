import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { actor, checkOrigin } from '@/lib/auth';
import { ensure } from '@/lib/rules';
import { failure } from '@/lib/http';
import { MAX_PRODUCT_IMAGE_BYTES, productImageType } from '@/lib/product-image';
import { assertWritesAllowed } from '@/lib/write-freeze';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertWritesAllowed();
    checkOrigin(request);
    const user = await actor();
    ensure(user.role === 'OWNER', 'Chỉ chủ spa được tải ảnh sản phẩm.', 403);
    const limit = MAX_PRODUCT_IMAGE_BYTES + 64 * 1024;
    ensure(Number(request.headers.get('content-length') || 0) <= limit, 'Ảnh vượt quá 5 MB.', 413);
    const reader = request.body?.getReader();
    ensure(reader, 'Chưa chọn ảnh.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); ensure(false, 'Ảnh vượt quá 5 MB.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const multipart = new Request('http://upload.local', { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body: Buffer.concat(chunks) });
    const form = await multipart.formData();
    const file = form.get('image');
    ensure(file instanceof File, 'Chưa chọn ảnh.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = productImageType(bytes);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'product_images' });
    const upload = bucket.openUploadStream('product-image', { metadata: { kind: 'PRODUCT_IMAGE', spaId: user.spaId, uploadedBy: user.id, contentType } });
    try { await pipeline(Readable.from([bytes]), upload); }
    catch (error) { await upload.abort().catch(() => {}); throw error; }
    return Response.json({ imageUrl: `/api/product-images/${upload.id}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
