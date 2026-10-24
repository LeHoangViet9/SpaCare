import mongoose from 'mongoose';
import {connect} from '../src/lib/db';
import {ServiceGroup} from '../src/lib/models';
try {
 const uri=new URL(process.env.MONGODB_URI||'');
 if(process.env.VERCEL_ENV==='production'||!['/spacare_dev','/spacare_test'].includes(uri.pathname))throw new Error('BLOCKED_TARGET');
 await connect();await ServiceGroup.createCollection();await ServiceGroup.createIndexes();
 console.log('Đã thêm collection/index nhóm dịch vụ trong dev/test; không sửa dịch vụ cũ.');
}catch{console.error('Chưa tạo được nhóm dịch vụ. Chỉ chạy trên spacare_dev/spacare_test; kiểm tra kết nối và quyền.');process.exitCode=1;}finally{await mongoose.disconnect();}
