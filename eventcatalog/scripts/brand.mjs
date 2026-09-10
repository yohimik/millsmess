import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { root } from './model.mjs';
const publicDir=join(root,'public');
const svg=await readFile(join(publicDir,'logo.svg'));
await writeFile(join(publicDir,'favicon.svg'),svg);
for (const [name,size] of [['logo.png',512],['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180],['android-chrome-192x192.png',192],['android-chrome-512x512.png',512]]) {
  await sharp(svg).resize(size,size).png().toFile(join(publicDir,name));
}
// ICO embeds a PNG image, supported by modern browsers and Windows.
const png=await sharp(svg).resize(32,32).png().toBuffer();
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=32;ico[7]=32;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
await writeFile(join(publicDir,'favicon.ico'),Buffer.concat([ico,png]));
const mark=svg.toString().replace(/<svg[^>]*>/, '<svg x="100" y="147" width="336" height="336" viewBox="0 0 24 24">');
const social=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0D0D0D"/>${mark}<text x="500" y="302" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700">Mills Mess</text><text x="504" y="361" fill="#A3A3A3" font-family="Arial,Helvetica,sans-serif" font-size="27">Session-based multiplayer.</text><text x="504" y="405" fill="#737373" font-family="Arial,Helvetica,sans-serif" font-size="21">Architecture · Events · Media</text></svg>`;
await sharp(Buffer.from(social)).png().toFile(join(publicDir,'opengraph.png'));
await writeFile(join(publicDir,'site.webmanifest'),JSON.stringify({name:'Mills Mess',short_name:'Mills Mess',icons:[{src:'/android-chrome-192x192.png',sizes:'192x192',type:'image/png'},{src:'/android-chrome-512x512.png',sizes:'512x512',type:'image/png'}],theme_color:'#0D0D0D',background_color:'#0D0D0D',display:'standalone'},null,2)+'\n');
console.log('Updated Mills Mess SVG, PNG, favicon, touch icons and social card');
