import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {tsImport} from 'tsx/esm/api';
const {default:ValidatedForm}=await tsImport('../src/components/validated-form.tsx',import.meta.url);
const {default:MoneyInput}=await tsImport('../src/components/money-input.tsx',import.meta.url);
const {default:ListFilters}=await tsImport('../src/components/list-filters.tsx',import.meta.url);
test('shared forms mark only required labels and preserve dotted money drafts',()=>{
 const html=renderToStaticMarkup(React.createElement(ValidatedForm,null,
 React.createElement('label',null,'Số tiền',React.createElement(MoneyInput,{name:'amount',required:true,defaultValue:'1.000.000'})),
 React.createElement('label',null,'Ghi chú',React.createElement('textarea',{name:'note',defaultValue:'Giữ nội dung'}))));
 assert.equal((html.match(/class="required-mark"/g)||[]).length,1);
 assert.match(html,/value="1.000.000"/);assert.match(html,/inputMode="numeric"/);assert.match(html,/Giữ nội dung/);
 const optional=html.slice(html.indexOf('Ghi chú'));assert.doesNotMatch(optional,/required-mark/);
});
test('date filters share a two-column wrapper and keep accessible labels',()=>{
 const html=renderToStaticMarkup(React.createElement(ListFilters,{section:'packages',values:{},today:'2026-10-23',staff:[],categories:[],onChange:()=>{}}));
 assert.match(html,/date-filter-pair/);assert.equal((html.match(/type="date"/g)||[]).length,2);assert.match(html,/Từ ngày/);assert.match(html,/Đến ngày/);
});
