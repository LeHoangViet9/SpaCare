import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import type { Actor } from './auth';
import { Product } from './models';
import { requirePublicSpa } from './public-spa';
import { storedProductImageId } from './product-image';
import { canViewProducts } from './product-rules';
import { ensure } from './rules';
import { withProductImageCacheHeaders } from './product-image-cache';

const objectId = /^[a-fA-F0-9]{24}$/;

async function serveOwnedImage(id: string, spaId: string) {
  ensure(objectId.test(id), 'Không tìm thấy ảnh.', 404);
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'product_images' });
  const imageId = new mongoose.Types.ObjectId(id);
  const file = await bucket.find({ _id: imageId, 'metadata.spaId': spaId, 'metadata.kind': 'PRODUCT_IMAGE' }).next();
  ensure(file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.metadata?.contentType), 'Không tìm thấy ảnh.', 404);
  return withProductImageCacheHeaders(new Response(Readable.toWeb(bucket.openDownloadStream(imageId)) as ReadableStream<Uint8Array>, {
    headers: {
      'Content-Type': file.metadata!.contentType, 'Content-Length': String(file.length),
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  }));
}

export async function readInternalProductImage(user: Actor, id: string) {
  ensure(canViewProducts(user), 'Không có quyền xem ảnh sản phẩm.', 403);
  // Preserve same-spa previews, including unused uploads and inactive products.
  return serveOwnedImage(id, user.spaId);
}

export async function readPublicProductImage(slug: string, productId: string) {
  ensure(objectId.test(productId), 'Không tìm thấy ảnh.', 404);
  const spa = await requirePublicSpa(slug);
  const product = await Product.findOne({ _id: productId, spaId: spa._id, active: true }).select('imageUrl').lean();
  const imageId = storedProductImageId(product?.imageUrl);
  ensure(imageId, 'Không tìm thấy ảnh.', 404);
  // The browser never chooses the image file; follow the verified product.
  return serveOwnedImage(imageId, String(spa._id));
}
