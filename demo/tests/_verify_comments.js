/* 检查所有页面渲染结果里有没有【未闭合的 HTML 注释】——
   注释没闭合会让整段后面的内容都被浏览器当成注释吃掉（看不见）。 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const fakeEl=()=>({style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},setAttribute(){},getAttribute(){return null},querySelector:()=>fakeEl(),querySelectorAll:()=>[],remove(){},innerHTML:'',textContent:'',value:'',focus(){},click(){}});
const sandbox={console,window:fakeEl(),document:{querySelector:()=>fakeEl(),querySelectorAll:()=>[],getElementById:()=>fakeEl(),addEventListener(){},removeEventListener(){},createElement:()=>fakeEl(),body:fakeEl()},localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,location:{href:'http://localhost/',pathname:'/'},history:{pushState(){},replaceState(){}}};
vm.createContext(sandbox);
for(const f of ['info.js','avatars.js','data.js','state.js','pages.js','app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),sandbox,{filename:f});
vm.runInContext('initState()',sandbox);
const PAGES = vm.runInContext('PAGES',sandbox);
let bad = 0;
const cases = [
  ['profile', () => PAGES.profile()],
  ['myFlags', () => PAGES.myFlags()],
  ['home', () => PAGES.home()],
  ['square', () => PAGES.square()],
  ['editProfile', () => PAGES.editProfile()],
  ['recordCard', () => PAGES.recordCard('f_success')],
  ['flagDetail', () => PAGES.flagDetail('f_success')],
  ['flagDetail-stop', () => PAGES.flagDetail('f_stop')],
  ['userProfile', () => PAGES.userProfile('小美')],
  ['notifs', () => PAGES.notifs()],
  ['verdict', () => PAGES.verdict()],
  ['checkin', () => PAGES.checkin('f_2')],
  ['checkinLog', () => PAGES.checkinLog('f_stop')],
  ['objection', () => PAGES.objection()],
  ['appeal', () => PAGES.appeal()],
  ['following', () => PAGES.following()],
  ['subs', () => PAGES.subs()],
  ['share', () => PAGES.share()],
  ['supervisorCard', () => PAGES.supervisorCard()],
  ['agreement', () => PAGES.agreement()],
  ['privacy', () => PAGES.privacy()],
  ['safeStop', () => PAGES.safeStop()],
  ['depositAgreement', () => PAGES.depositAgreement()],
  ['flagMenu', () => PAGES.flagMenu()],
  ['credDetail', () => PAGES.credDetail()],
  ['recruitDetail', () => PAGES.recruitDetail('f_3')],
  ['witnessPool', () => PAGES.witnessPool()],
  ['witnessEarnings', () => PAGES.witnessEarnings()],
  ['verdictDetail', () => PAGES.verdictDetail()],
  ['created', () => PAGES.created()],
  ['login', () => PAGES.login()],
  ['splash', () => PAGES.splash()],
];
for (const [name, fn] of cases) {
  let h;
  try { h = fn(); } catch(e){ console.log('  ✗ ' + name + ' 渲染抛错: ' + e.message); bad++; continue; }
  if (typeof h !== 'string') { console.log('  - ' + name + ' 不是字符串'); continue; }
  const open = (h.match(/<!--/g)||[]).length;
  const close = (h.match(/-->/g)||[]).length;
  if (open !== close) {
    console.log('  ✗ ' + name + ' 注释不闭合 (' + open + ' 开 / ' + close + ' 闭)');
    bad++;
  }
}
console.log(bad === 0 ? '✅ 全部页面的注释都闭合' : '❌ ' + bad + ' 个页面有问题');
process.exit(bad === 0 ? 0 : 1);
