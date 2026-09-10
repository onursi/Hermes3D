/** An explicit current block is authoritative, including deliberately empty fields. */
export function projectWorkState(text:string){
 const source=text.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm,'');
 const match=/^## Aktueller Arbeitsstand\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(source);
 if(!match)return null;
 const fields=new Map([...match[1].matchAll(/^### ([^\r\n]+)\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm)].map(m=>[m[1].trim(),m[2].trim()]));
 const next=fields.get('Nächster Schritt')?.split(/\r?\n/).find(line=>/^\s*(?:- \[ \]|[-*]|\d+\.)\s+/.test(line)&&!/^\s*- \[[xX]\]/.test(line));
 return {summary:fields.get('Ergebnis'),current:fields.get('Stand'),next:next?.replace(/^\s*(?:- \[ \]|[-*]|\d+\.)\s+/,''),blocker:fields.get('Blocker')};
}
