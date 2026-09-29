const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const KEY = 'martinium:dsa:v1';
function setup(initial = null) {
  const values = new Map(initial === null ? [] : [[KEY, initial]]);
  let syncs = 0;
  const context = {localStorage: {getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value)}, window: {Sync: {schedule: () => syncs++}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/dsa-store.js','utf8') + '\nthis.store = DSAStore;', context);
  return {store: context.store, values, syncs: () => syncs};
}

test('completion has no mastery evidence and evidence does not complete lessons', () => {
  const {store,values,syncs} = setup();
  values.set('martinium:completion','true');
  assert.equal(store.mastery('arrays').Trace.score,null);
  store.record('arrays','Trace','question-1',true);
  assert.equal(store.mastery('arrays').Trace.score,100);
  assert.equal(store.mastery('arrays').Implement.score,null);
  assert.equal(store.read().completed,undefined);
  assert.equal(values.get('martinium:completion'),'true');
  assert.equal(store.KEY,KEY);
  assert.equal(syncs(),1);
});

test('evidence retries replace result and dimensions retain separate evidence', () => {
  const {store} = setup();
  store.record('binary-search','Trace','same-id',true);
  store.record('binary-search','Implement','same-id',true);
  store.record('binary-search','Trace','same-id',false);
  assert.equal(store.mastery('binary-search').Trace.count,1);
  assert.equal(store.mastery('binary-search').Trace.score,0);
  assert.equal(store.mastery('binary-search').Implement.score,100);
  assert.equal(Object.values(store.read().evidence).find(item => item.dimension === 'Trace').attempts,2);
});

test('review due dates reflect failure and spaced successful repetitions', () => {
  const {store} = setup();
  store.record('arrays','Trace','one',false);
  let item = Object.values(store.read().evidence)[0];
  assert.equal(item.due-item.at,600000);
  assert.equal(store.reviews(item.due-1).length,0);
  assert.equal(store.reviews(item.due).length,1);
  store.record('arrays','Trace','one',true);
  item = Object.values(store.read().evidence)[0];
  assert.equal(item.due-item.at,86400000);
  store.record('arrays','Trace','one',true);
  item = Object.values(store.read().evidence)[0];
  assert.equal(item.due-item.at,2*86400000);
  assert.equal(store.mastery('arrays',item.due).Trace.due,true);
});

test('recommendations exclude unmet prerequisites, completion, and unavailable lessons', () => {
  const {store} = setup();
  const topics = [
    {id:'arrays',status:'legacy',prerequisites:[]},
    {id:'binary-search',status:'published',prerequisites:['arrays']},
    {id:'trees',status:'published',prerequisites:['recursion']},
    {id:'future',status:'planned',prerequisites:[]},
    {id:'ambiguous',status:'unresolved',prerequisites:[]},
    {id:'unknown',status:'oops',prerequisites:[]},
  ];
  assert.deepEqual(Array.from(store.recommendations({topics}, id=>id==='arrays'),item=>item.id),['binary-search']);
  assert.equal(store.ready({prerequisites:'arrays'},()=>true),false);
});

test('corrupt persisted shapes recover without truthy malformed mastery', () => {
  const {store} = setup(JSON.stringify({notes:{ok:5},library:[],bookmarks:{bad:null},evidence:{bad:{topic:'arrays',dimension:'Trace',passed:'false'}},activity:[null,5],path:{bad:true}}));
  assert.equal(Object.keys(store.read().notes).length,0);
  assert.equal(Object.keys(store.read().bookmarks).length,0);
  assert.equal(store.mastery('arrays').Trace.score,null);
  assert.equal(store.read().activity.length,0);
  assert.equal(store.read().path,'foundations');
  assert.equal(setup('{broken').store.read().version,1);
});

test('prototype keys cannot be persisted or used as record IDs', () => {
  const {store} = setup('{"notes":{"__proto__":"polluted","constructor":"bad","topic:arrays":"safe"},"library":{"prototype":{}}}');
  assert.equal(Object.keys(store.read().notes).length,1);
  assert.throws(()=>store.note('__proto__','bad'));
  assert.throws(()=>store.resource('constructor',{}));
  assert.throws(()=>store.record('prototype','Trace','id',true));
  assert.equal({}.polluted,undefined);
});

test('notes, library and frame bookmarks stay scoped and preserve independent fields', () => {
  const {store} = setup();
  store.note('topic:arrays','my note');
  store.note('resource:book','book note');
  store.resource('book',{notes:'resource note',favorite:true});
  store.resource('book',{progress:140,status:'Learning',rating:8,position:'Chapter 2'});
  assert.equal(store.read().notes['topic:arrays'],'my note');
  assert.equal(store.read().notes['resource:book'],'book note');
  assert.equal(store.read().library.book.notes,'resource note');
  assert.equal(store.read().library.book.favorite,true);
  assert.equal(store.read().library.book.progress,100);
  assert.equal(store.read().library.book.rating,5);
  store.bookmark('frame:arrays:0',{topic:'arrays',kind:'frame',frame:0,input:{values:[1,2]}});
  assert.equal(store.read().bookmarks['frame:arrays:0'].input.values[1],2);
  store.bookmark('frame:arrays:0',null);
  assert.equal(Object.keys(store.read().bookmarks).length,0);
});

test('self reports are labeled, histories bounded, and old evidence keys migrate', () => {
  const {store} = setup(JSON.stringify({evidence:{'arrays:q':{topic:'arrays',dimension:'Explain',evidenceId:'q',passed:true,source:'self-assessment',at:1,due:2,attempts:1,streak:1}}}));
  assert.equal(store.mastery('arrays').Explain.selfReported,true);
  store.record('arrays','Explain','q',false);
  assert.equal(store.mastery('arrays').Explain.count,1);
  for(let i=0;i<105;i++) store.visit('arrays');
  assert.equal(store.read().activity.length,100);
  assert.throws(()=>store.record('arrays','Trace','q','false'));
});
