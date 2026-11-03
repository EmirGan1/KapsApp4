import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthUserFromRequest } from '../src/server/courseController.ts';
import { formatMessageDate } from '../src/utils/messageDate.ts';
test('caller supplied identity and IP cannot authenticate', async () => {
 const req: any = {headers:{'x-username':'emirgan','x-forwarded-for':'127.0.0.1'},query:{userId:1},body:{},socket:{remoteAddress:'127.0.0.1'}};
 const client = {execute:async()=>{throw new Error('Unauthenticated identity must not query users');}};
 assert.equal(await getAuthUserFromRequest(req,client), null);
});
test('message calendar dates', () => {
 const today=new Date(); today.setHours(12,0,0,0);
 for (let n=1;n<=3;n++){const d=new Date(today);d.setDate(d.getDate()-n);assert.equal(formatMessageDate(d),`${n} gün önce`);}
 const old=new Date(today);old.setDate(old.getDate()-4);
 assert.equal(formatMessageDate(old),old.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}));
 assert.equal(formatMessageDate('invalid'),'');
});
