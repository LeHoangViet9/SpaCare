'use client';
import type { ReactNode } from 'react';
import { cartGroups } from '@/lib/cart-groups';
type Row = Record<string, any>;
export default function GroupedCartLines({ items, label, renderItem }: {
  items: Row[]; label: string; renderItem: (item: Row) => ReactNode;
}) {
  return <>{cartGroups(items as (Row & { _id: string })[]).map(group => group.length === 1
    ? <div key={group[0]._id}>{renderItem(group[0])}</div>
    : <details className="cashier-cart-group" key={group[0]._id}
        onInvalidCapture={event => { event.currentTarget.open = true; }}>
        <summary><strong>{label}: {group[0].name} ×{group.length}</strong><small>Chi tiết từng lượt</small></summary>
        {group.map((item, index) => <details className="cashier-cart-unit" key={item.lineId || item.cartId || index}
          onInvalidCapture={event => { event.currentTarget.open = true; }}>
          <summary>Lượt {index + 1}{item.recipientName ? ` · ${item.recipientName}` : ''}</summary>
          {renderItem(item)}
        </details>)}
      </details>)}</>;
}
