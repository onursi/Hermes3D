import {getAudioContext,getAtmosphereVolume} from '../atmosphereAudio';
import {localSound,type SoundName} from '../localAudio';
class JarvisAudioEngine{
 private beam:(()=>void)|undefined;
 private play(name:SoundName,level=.3,rate=1){return localSound(getAudioContext(),name,getAtmosphereVolume()*level,{rate});}
 playChime(rate=1){this.play('confirm',.25,rate);}
 playScanSweep(){this.play('scan');}
 startBeamSound(){this.stopBeamSound();this.beam=localSound(getAudioContext(),'beam',getAtmosphereVolume()*.12,{loop:true}).stop;}
 stopBeamSound(){this.beam?.();this.beam=undefined;}
 playModeSwitch(){this.play('select');}
 playBlip(){this.play('select',.15);}
}
export const jarvisAudio=new JarvisAudioEngine();
