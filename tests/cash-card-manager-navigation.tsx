import {useSyncExternalStore} from 'react';
let query='';const listeners=new Set<()=>void>();
export function usePathname(){return '/workspace/cash_cards';}
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>query,()=>query));}
export function useRouter(){return {replace:(url:string)=>{query=new URL(url,'https://fixture.test').search;for(const fn of listeners)fn();}};}
