'use client';
import { Children, cloneElement, isValidElement, useState, createContext, useContext, type ReactNode, type ReactElement, type FormHTMLAttributes } from 'react';
const FieldErrors = createContext<Record<string,string>>({});
export const useFieldError = (name:string)=>useContext(FieldErrors)[name];
function containsRequired(node:ReactNode):boolean {
 return Children.toArray(node).some(child=>isValidElement(child) && ((child.props as any).required || containsRequired((child.props as any).children)));
}
function translate(input:HTMLInputElement) {
 const v=input.validity;
 if(v.valueMissing)return 'Vui lòng nhập hoặc chọn thông tin này.';
 if(v.typeMismatch)return 'Thông tin chưa đúng định dạng.';
 if(v.patternMismatch)return input.inputMode==='numeric'?'Nhập số tiền nguyên, ví dụ 1.000.000.':'Thông tin chưa đúng định dạng.';
 if(v.rangeUnderflow)return 'Giá trị tối thiểu là '+input.min+'.';
 if(v.rangeOverflow)return 'Giá trị tối đa là '+input.max+'.';
 if(v.stepMismatch)return 'Giá trị không đúng bước cho phép.';
 return 'Vui lòng kiểm tra giá trị đã nhập.';
}
function fields(node:ReactNode, errors:Record<string,string>, path='f'):ReactNode {
 return Children.map(node,(child,index)=>{
  if(!isValidElement(child))return child;
  const element = child as ReactElement<any>;
  const key=path+'-'+index, props=element.props;
  const children=props.children === undefined ? undefined : fields(props.children,errors,key);
  if(child.type==='label') {
   const required=containsRequired(props.children);
   const names:string[]=[];
   const collect=(nodes:ReactNode)=>Children.forEach(nodes,c=>{if(isValidElement(c)){const p=c.props as any;if(p.name)names.push(p.name);collect(p.children);}});collect(props.children);
   const message=names.map(name=>errors[name]).find(Boolean) || errors[key];
   return cloneElement(element,{},<>{Children.map(children,(c,i)=>i===0?<span className="form-label-text">{c}{required && <span className="required-mark" aria-hidden="true"> *</span>}</span>:c)}{message && <small className="field-error" role="alert">{message}</small>}</>);
  }
  if(['input','select','textarea'].includes(String(child.type)) || props.required && props.children === undefined)return cloneElement(element,{'data-field-key':props.name || path,'aria-invalid':errors[props.name || path]?true:undefined});
  return props.children === undefined ? child : cloneElement(element,{},children);
 });
}
export function FormFields({children,errors}:{children:ReactNode;errors?:Record<string,string>}) {const context=useContext(FieldErrors);return <>{fields(children,errors || context)}</>;}
export default function ValidatedForm({children,onInvalid,onInput,fieldErrors={},...props}:FormHTMLAttributes<HTMLFormElement> & {fieldErrors?:Record<string,string>}) {
 const [errors,setErrors]=useState<Record<string,string>>({});
 return <FieldErrors.Provider value={{...fieldErrors,...errors}}><form {...props} onInvalid={e=>{e.preventDefault();const input=e.target as HTMLInputElement;setErrors(old=>({...old,[input.name || input.dataset.fieldKey || '']:translate(input)}));onInvalid?.(e);}} onInput={e=>{const input=e.target as HTMLInputElement;const key=input.name || input.dataset.fieldKey || '';setErrors(old=>{if(!old[key])return old;const next={...old};delete next[key];return next;});onInput?.(e);}}><FormFields errors={{...fieldErrors,...errors}}>{children}</FormFields></form></FieldErrors.Provider>;
}
