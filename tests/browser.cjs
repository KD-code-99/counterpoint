// Browser acceptance against this application's local server or its own deployment.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const base=process.env.COUNTERPOINT_URL || 'http://127.0.0.1:4318';
const out=path.resolve(__dirname,'../evidence'); fs.mkdirSync(out,{recursive:true});
async function main(){
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const report={scope:'Owned Counterpoint workshop only; no live Qloo calls or customer outcome claims.',checked_at:new Date().toISOString(),url:base,widths:[],checks:[]};
  try{
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByText('Checked, independently.',{exact:true}).waitFor();
    assert.match(await page.locator('#mode-notice').innerText(),/invented/);
    for(const width of [320,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(dimensions.scroll<=dimensions.width,`Page overflows at ${width}px: ${dimensions.scroll}`);
      await page.screenshot({path:path.join(out,`workshop-${width}.png`),fullPage:true});
      report.widths.push({width,horizontal_page_overflow:false});
    }
    const before=await page.locator('.book h3').allTextContents();
    const selectedTitle=before[0];
    await page.getByLabel(`${selectedTitle} available`,{exact:true}).uncheck();
    await page.waitForFunction(title=>![...document.querySelectorAll('.book h3')].some(e=>e.textContent===title),selectedTitle);
    report.checks.push('Making a selected book unavailable changes the slate.');
    await page.getByRole('button',{name:'Clear pins & stock changes'}).click();
    await page.getByLabel('Pin A Map of Unwritten Cities',{exact:true}).check();
    await page.getByLabel('A Map of Unwritten Cities available',{exact:true}).uncheck();
    await page.getByText('This table needs an adjustment.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'↓ Decision receipt'}).isDisabled(),true);
    await page.getByRole('button',{name:'Clear pins & stock changes'}).click();
    await page.getByText('Checked, independently.',{exact:true}).waitFor();
    report.checks.push('Conflicting pin/stock constraints show an actionable empty state and disable receipt export.');
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'↓ Decision receipt'}).click();
    const download=await downloadPromise, receiptPath=path.join(out,'browser-workshop-receipt.json');
    await download.saveAs(receiptPath);
    const receipt=JSON.parse(fs.readFileSync(receiptPath));assert.equal(receipt.provenance.live_qloo,false);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#receipt-file').setInputFiles(receiptPath);
    await page.getByText(/Saved receipt: both choices/).waitFor();
    const edited=structuredClone(receipt);edited.balanced.floor++;
    await page.locator('#receipt-file').setInputFiles({name:'edited.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(edited))});
    await page.getByText('Receipt check failed.',{exact:true}).waitFor();
    report.checks.push('Downloaded receipt verifies after reload; an edited receipt is rejected.');
    await page.getByRole('button',{name:'Start with your cultural briefs'}).click();
    await page.getByLabel('Search cultural reference for brief 1',{exact:true}).fill('Spirited Away');
    await page.getByLabel('Search cultural reference for brief 1',{exact:true}).press('Enter');
    await page.getByText(/Live discovery is waiting for the organizer-issued Qloo credential/).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#briefs-dialog').isVisible(),false);
    report.checks.push('Keyboard search reports missing Qloo access explicitly; Escape closes the dialog.');
    await page.getByRole('button',{name:'How it works'}).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#about-dialog').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#about-open').evaluate(e=>e===document.activeElement),true);
    report.checks.push('Explanation dialog opens by keyboard and restores focus.');
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.inventory').isVisible(),false);
    assert.equal(await page.locator('#slate').isVisible(),true);
    assert.equal(await page.locator('#mode-notice').isVisible(),true);
    await page.pdf({path:path.join(out,'reading-slate.pdf'),format:'A4',printBackground:true});
    report.checks.push('Print view retains the slate and comparison; hides editing controls.');
    await page.emulateMedia({media:'screen'});
    let axePath=process.env.AXE_SCRIPT;
    if(!axePath){try{axePath=require.resolve('axe-core/axe.min.js');}catch{}}
    if(axePath){
      await page.evaluate(fs.readFileSync(axePath,'utf8'));
      const axe=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
      report.accessibility={engine:axe.testEngine,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.length})),incomplete:axe.incomplete.map(v=>v.id)};
      assert.equal(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).length,0);
    }else report.accessibility={automated_audit:'not run',keyboard_checks:'passed; not a WCAG conformance claim'};
    assert.deepEqual(errors,[]);report.status='PASS';
  }catch(e){report.status='FAIL';report.error=e.stack;throw e;}
  finally{fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
