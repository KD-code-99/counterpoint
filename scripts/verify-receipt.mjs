import {readFileSync} from 'node:fs';
import {verifyReceipt} from '../lib/checker.mjs';
if (!process.argv[2]) { console.error('Usage: npm run verify -- receipt.json'); process.exit(2); }
try {
  const result=verifyReceipt(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.valid?0:1;
} catch(e) {console.error(e.message);process.exitCode=1;}
