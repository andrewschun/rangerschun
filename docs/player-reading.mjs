/** Present the uploaded document as source material. Does not assign training or collect player data. */
export function startPlayerReading(guide){
  const element=id=>document.getElementById(id);
  let pageIndex=0,mode='text';
  const picker=element('reading-page');
  for(const page of guide.pages){const option=document.createElement('option');option.value=String(page.number);option.textContent=`${page.number}. ${page.label}`;picker.append(option);}
  // Data URLs are embedded by the standalone packager; Blob URLs also support opening in a new tab.
  const pdfLinks=[...document.querySelectorAll('[data-reading-pdf]')];
  const pdfUrls=new Map();
  for(const link of pdfLinks){const href=link.getAttribute('href');if(href?.startsWith('data:application/pdf;base64,')){
    if(!pdfUrls.has(href)){const bytes=Uint8Array.from(atob(href.split(',')[1]),char=>char.charCodeAt(0));pdfUrls.set(href,URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})));}
    link.href=pdfUrls.get(href);
  }}
  function render(focus=false){
    const page=guide.pages[pageIndex],article=element('reading-text');
    picker.value=String(page.number);element('reading-position').textContent=`Page ${page.number} of ${guide.page_count} · ${page.label}`;
    element('reading-previous').disabled=pageIndex===0;element('reading-next').disabled=pageIndex===guide.pages.length-1;
    element('reading-page-title').textContent=page.title;
    article.replaceChildren();let list=null;
    for(const block of page.blocks){
      if(block.kind==='list'){
        if(!list){list=document.createElement('ul');article.append(list);}const item=document.createElement('li');item.textContent=block.text;list.append(item);
      }else{list=null;const node=document.createElement(block.kind==='heading'?'h3':'p');node.textContent=block.text;article.append(node);}
    }
    article.hidden=mode!=='text';const image=element('reading-original');image.hidden=mode!=='original';
    if(mode==='original'){image.src=page.image_url;image.alt=`Original document, page ${page.number}: ${page.title}. The same page is available in text view.`;}
    for(const button of document.querySelectorAll('[data-reading-mode]')){const selected=button.dataset.readingMode===mode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
    if(focus){element('reading-page-title').focus({preventScroll:true});element('reading-reader').scrollIntoView({block:'start',behavior:'smooth'});}
  }
  picker.addEventListener('change',()=>{pageIndex=guide.pages.findIndex(page=>page.number===Number(picker.value));render(true);});
  element('reading-previous').addEventListener('click',()=>{if(pageIndex>0){pageIndex--;render(true);}});
  element('reading-next').addEventListener('click',()=>{if(pageIndex<guide.pages.length-1){pageIndex++;render(true);}});
  for(const button of document.querySelectorAll('[data-reading-mode]'))button.addEventListener('click',()=>{mode=button.dataset.readingMode;render();});
  render();
}
