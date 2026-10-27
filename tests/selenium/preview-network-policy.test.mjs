import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedConnectTarget} from './preview-network-policy.mjs';
test('exact Preview HTTPS tunnel accepted',()=>{
 assert.equal(allowedConnectTarget('spacare-7smadvclt-hviet15.vercel.app:443'),true);
});
test('all other authorities rejected without network access',()=>{
 for(const value of ['spacare-rho.vercel.app:443','other.vercel.app:443',
 'spacare-7smadvclt-hviet15.vercel.app.evil.invalid:443',
 'spacare-7smadvclt-hviet15.vercel.app:80',
 'spacare-7smadvclt-hviet15.vercel.app.:443','127.0.0.1:443',
 'user@spacare-7smadvclt-hviet15.vercel.app:443',undefined])
  assert.equal(allowedConnectTarget(value),false);
});
