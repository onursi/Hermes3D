export function beamStage(elapsed:number,searching:boolean,hasTargets:boolean,reduced=false){
 if(!reduced&&elapsed<.45)return 'docking';
 if((!reduced&&elapsed<1.65)||(!hasTargets&&searching))return 'scanning';
 return hasTargets?'locked':'empty';
}
