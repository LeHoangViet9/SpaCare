import {actor} from '@/lib/auth';
import {readDiscountPrograms} from '@/lib/discount-program-read';
import {failure} from '@/lib/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return Response.json(await readDiscountPrograms(await actor(),new URL(request.url).searchParams),{headers:{'Cache-Control':'no-store, private'}});}
 catch(error){return failure(error);}
}
