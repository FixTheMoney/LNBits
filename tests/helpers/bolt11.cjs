'use strict';
// Checksum-valid synthetic BOLT11; intentionally no real signature or payee.
function invoice({hash='a'.repeat(64),fields,hrp='lnbc1000n'}={}) {
  const alphabet='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let acc=0,count=0;const words=[];
  for(const byte of Buffer.from(hash,'hex')) {
    acc=(acc<<8)|byte;count+=8;
    while(count>=5) {count-=5;words.push((acc>>>count)&31);}
  }
  if(count) words.push((acc<<(5-count))&31);
  const data=[...Array(7).fill(0),...(fields||[1,1,20,...words]),...Array(104).fill(0)];
  const expanded=[...hrp].map(c=>c.charCodeAt(0)>>>5).concat(0,[...hrp].map(c=>c.charCodeAt(0)&31));
  let check=1;
  for(const v of expanded.concat(data,[0,0,0,0,0,0])) {
    const top=check>>>25;check=((check&0x1ffffff)<<5)^v;
    [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i)=>{if((top>>>i)&1)check^=g;});
  }
  check^=1;
  return hrp+'1'+data.concat(Array.from({length:6},(_,i)=>(check>>>(5*(5-i)))&31)).map(n=>alphabet[n]).join('');
}
module.exports={invoice};
