export type WorkTask={id:string;content:string;isCompleted?:boolean;priority?:number;dueDate?:string|null;projectName?:string};
export function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function taskDate(value?:string|null){return value&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;}
export function orderedTasks(tasks:WorkTask[],today:string){
 const rank=(t:WorkTask)=>{const date=taskDate(t.dueDate);return date&&date<today?0:date===today?1:2;};
 return tasks.filter(t=>!t.isCompleted&&typeof t.id==='string'&&typeof t.content==='string').slice().sort((a,b)=>rank(a)-rank(b)||(taskDate(a.dueDate)||'9999').localeCompare(taskDate(b.dueDate)||'9999')||(b.priority||1)-(a.priority||1)||a.content.localeCompare(b.content,'de'));
}
