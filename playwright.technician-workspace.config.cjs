const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({testDir:'tests',testMatch:'technician-workspace.spec.cjs',outputDir:'outputs/technician-workspace',timeout:30000,workers:1,
 use:{baseURL:'http://127.0.0.1:3222',browserName:'chromium',launchOptions:process.env.SPACARE_TEST_CHROME?{executablePath:path.resolve(process.env.SPACARE_TEST_CHROME)}:{}},
 webServer:{command:'node --import tsx scripts/test-technician-workspace.ts',url:'http://127.0.0.1:3222',reuseExistingServer:false},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
