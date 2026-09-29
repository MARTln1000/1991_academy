const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.DSA_TEST_URL || 'http://127.0.0.1:8746';
const content=id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/dsa/lessons',id+'.json'),'utf8'));
const extras={ 'avl-tree': 'function isBalanced(n){function h(n){if(!n)return 0;const a=h(n.left),b=h(n.right);return a<0||b<0||Math.abs(a-b)>1?-1:1+Math.max(a,b);}return h(n)>=0;}', dijkstra:'function relax(d,u,v,w){if(d[u]+w<d[v]){d[v]=d[u]+w;return true;}return false;}'};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/snap/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:1000}}); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/tracks/dsa.html');
 await page.getByRole('heading',{name:'Your learning workspace'}).waitFor();
 for(const id of ['binary-search','avl-tree','dijkstra','knapsack']){
  await page.goto(base+'/tracks/dsa.html#topic/'+id);
  await page.locator('[data-position]').waitFor();
  console.log(id,await page.locator('[data-position]').textContent());
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('button',{name:'Previous',exact:true}).click();
  await page.getByRole('button',{name:'Predict next step'}).click();
  await page.locator('[data-prediction] button').first().click();
  await page.locator('[data-note]').fill('Browser-tested note for '+id);
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.locator('[data-run-language]').selectOption('javascript');
  await page.getByRole('button',{name:'Run tests',exact:true}).click();
  await page.locator('[data-run-results]').getByText('Not all tests passed.',{exact:true}).waitFor();
  await page.locator('[data-editor] textarea').fill(content(id).implementations.javascript+'\n'+(extras[id]||''));
  await page.getByRole('button',{name:'Run tests',exact:true}).click();
  await page.locator('[data-run-results]').getByText('All tests passed.',{exact:true}).waitFor();
  const oldEvidence=await page.evaluate(()=>DSAStore.mastery(location.hash.split('/')[1]).Implement.passed);
  assert.ok(oldEvidence>0,'passing implementation creates mastery evidence');
  await page.getByRole('button',{name:'Mark lesson complete',exact:true}).click();
  const completed=await page.evaluate(id=>Progress.isDone(id),id);assert.equal(completed,true);
  await page.locator('[data-question]').fill('What invariant is maintained?');
  await page.getByRole('button',{name:'Ask',exact:true}).click();
  await page.locator('[data-provider]').getByText('Local guided response — no AI model used',{exact:true}).waitFor();
 }
 for(const name of ['curriculum','paths','patterns','practice','lab','complexity','memory','resources','library','graph','notes']){
  await page.goto(base+'/tracks/dsa.html#'+name);
  await page.locator('#dsa-root h2').first().waitFor();
  assert.equal(await page.getByText('Unable to load this view',{exact:true}).count(),0,name);
  console.log('route',name);
 }
 await page.goto(base+'/tracks/dsa.html#resources');
 await page.getByRole('button',{name:'Save to library',exact:true}).first().click();
 await page.goto(base+'/tracks/dsa.html#library');
 await page.locator('[data-lib="notes"]').first().fill('Useful chapter');
 await page.locator('[data-lib="notes"]').first().blur();
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/tracks/dsa.html#topic/binary-search');
 await page.locator('[data-position]').waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
 await page.screenshot({path:process.env.DSA_SCREENSHOT || '/tmp/dsa-mobile.png',fullPage:true});
 assert.equal(overflow,false,'mobile horizontal overflow');
 assert.deepEqual(errors,[]);
 console.log('PASS browser routes, traces, predictions, drafts, tutor, library, notes, mobile; no JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
