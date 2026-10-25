// Display colours from the coach's supplied Driveline ball chart.
export const DRIVELINE_BALL_SWATCHES=Object.freeze({gray:'#7f858b','dark green':'#235c46',yellow:'#e7bf2f',red:'#df493d',purple:'#8851a3',orange:'#ef9c11',blue:'#087ab9',maroon:'#803d50',green:'#00a768',pink:'#e78db8'});

// Call only for Driveline ball references; keep the source wording and punctuation.
export function appendDrivelineBallText(container,text){
  const source=String(text),pattern=/\b(dark[ -]green|gray|grey|yellow|red|purple|orange|blue|maroon|green|pink)\b/gi;
  let last=0;
  for(const match of source.matchAll(pattern)){
    if(match.index>last)container.append(document.createTextNode(source.slice(last,match.index)));
    const color=match[0].toLowerCase().replace('-',' ').replace('grey','gray'),label=document.createElement('span'),dot=document.createElement('span');
    label.className='driveline-ball-label';dot.className='driveline-color-dot';dot.style.setProperty('--driveline-ball-color',DRIVELINE_BALL_SWATCHES[color]);dot.setAttribute('aria-hidden','true');label.append(dot,document.createTextNode(match[0]));container.append(label);last=match.index+match[0].length;
  }
  if(last<source.length)container.append(document.createTextNode(source.slice(last)));
  return container;
}
