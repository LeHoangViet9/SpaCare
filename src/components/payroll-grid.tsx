import type { ReactNode } from 'react';
export default function PayrollGrid({label,headers,rows,empty}: {label:string;headers:string[];rows:ReactNode[][];empty:string}) {
 return <div className="payroll-grid-scroll" role="region" aria-label={label} tabIndex={0}><table className="payroll-grid" style={{minWidth:Math.max(720,headers.length*140)}}><caption>{label}</caption><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>):<tr><td colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>;
}
