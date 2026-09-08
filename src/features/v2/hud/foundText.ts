export function searchTerms(query:string){return [...new Set(query.match(/[\p{L}\p{N}_-]{2,}/gu)??[])].sort((a,b)=>b.length-a.length).slice(0,20);}
export function termPattern(query:string){const words=searchTerms(query);return words.length?new RegExp('('+words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','giu'):null;}
export function matchingExcerpt(text:string,query:string){const pattern=termPattern(query);const first=pattern?.exec(text);if(!first)return '';const start=Math.max(0,first.index-120);return (start?'…':'')+text.slice(start,start+520)+(text.length>start+520?'…':'');}
type TextTree={type:string;value?:string;tagName?:string;properties?:Record<string,unknown>;children?:TextTree[]};
/** A HAST transform, never HTML injection. Links and original Markdown survive. */
export function highlightFoundText(query:string){return ()=> (tree:TextTree)=>{
 const pattern=termPattern(query);if(!pattern)return;
 const walk=(parent:TextTree)=>{if(!parent.children||parent.tagName==='mark')return;parent.children=parent.children.flatMap(child=>{
  if(child.type!=='text'||!child.value){walk(child);return[child];}
  const value=child.value;const parts:TextTree[]=[];let end=0;pattern.lastIndex=0;
  for(const match of value.matchAll(pattern)){const start=match.index!;if(start>end)parts.push({type:'text',value:value.slice(end,start)});parts.push({type:'element',tagName:'mark',properties:{'data-found':'true'},children:[{type:'text',value:match[0]}]});end=start+match[0].length;}
  if(end<value.length)parts.push({type:'text',value:value.slice(end)});return parts.length?parts:[child];
 });};walk(tree);
};}
