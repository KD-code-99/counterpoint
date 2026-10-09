const {Client,StreamableHTTPClientTransport}=require(process.env.MCP_CLIENT_MODULE || '@modelcontextprotocol/client');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=new URL('/api/mcp',process.env.COUNTERPOINT_URL || 'http://127.0.0.1:4318');
async function main(){
  const rows=[];
  for(const mode of ['legacy','auto']){
    const client=new Client({name:'counterpoint-acceptance',version:'0.1.0'},{versionNegotiation:{mode}});
    const transport=new StreamableHTTPClientTransport(url);
    try{
      await client.connect(transport);
      assert.equal(client.getServerVersion().name,'counterpoint');
      const {tools}=await client.listTools();assert.equal(tools.length,4);
      const result=await client.callTool({name:'counterpoint_curate',arguments:{mode:'workshop',slots:2}});
      assert.notEqual(result.isError,true);
      const receipt=JSON.parse(result.content[0].text).receipt;
      const verified=await client.callTool({name:'counterpoint_verify',arguments:{receipt}});
      assert.equal(JSON.parse(verified.content[0].text).valid,true);
      const failed=await client.callTool({name:'counterpoint_search',arguments:{query:'Some movie',type:'movie'}});
      assert.equal(failed.isError,true);
      rows.push({mode,protocol_era:client.getProtocolEra(),tool_count:tools.length,curate_and_verify:true,access_failure_explicit:true});
    }finally{await client.close();}
  }
  const report={status:'PASS',checked_at:new Date().toISOString(),endpoint:url.href,client:'@modelcontextprotocol/client',scope:'Official client transport interoperability using authored workshop fixtures; not live Qloo evidence or official certification.',checks:rows};
  const out=path.resolve(__dirname,'../evidence');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'mcp-interop.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
