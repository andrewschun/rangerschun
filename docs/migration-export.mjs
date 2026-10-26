import {OLD_RANGERS_ORIGIN,NEW_RANGERS_ORIGIN,DEVICE_COPY_CHANNEL,collectDeviceEntries} from './device-migration-core.mjs?v=rangers-organization-20261025';
const params=new URLSearchParams(location.hash.slice(1)),scope=params.get('scope'),nonce=params.get('nonce'),button=document.getElementById('copy'),status=document.getElementById('status');
if(location.origin!==OLD_RANGERS_ORIGIN||!window.opener||!/^[a-f0-9]{1,8}$/.test(scope??'')||!/^[a-f0-9-]{36}$/.test(nonce??'')){
 button.disabled=true;status.textContent='Open the new Rangers site and choose Copy saved entries from there.';
}else button.addEventListener('click',()=>{try{const bundle=collectDeviceEntries(localStorage,scope);window.opener.postMessage({channel:DEVICE_COPY_CHANNEL,nonce,bundle},NEW_RANGERS_ORIGIN);button.disabled=true;status.textContent='Sent to the new site. Return there to check the result. Your originals remain at this address.';}catch(error){status.textContent=error.message;}});
