import {useSyncExternalStore} from 'react';
function subscribe(fn:()=>void){window.addEventListener('popstate',fn);window.addEventListener('urlchange',fn);return()=>{window.removeEventListener('popstate',fn);window.removeEventListener('urlchange',fn);};}
export function usePathname(){return useSyncExternalStore(subscribe,()=>location.pathname);}
export function useSearchParams(){const search=useSyncExternalStore(subscribe,()=>location.search);return new URLSearchParams(search);}
export function useRouter(){return {push:(url:string)=>{history.pushState(null,'',url);window.dispatchEvent(new Event('urlchange'));}};}
