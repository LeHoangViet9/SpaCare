'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

// Keep fixed navigation outside page containers and their scrolling/layout effects.
export default function MobileNavigationLayer({children}:{children:ReactNode}){
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 return mounted ? createPortal(<div className="workspace-navigation-layer">{children}</div>,document.body) : null;
}
