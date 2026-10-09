import { describe, expect, it } from "vitest";
import { currentGaze, damp, gazeFromFace, neutralGaze } from "../../src/features/v2/jarvis/live/tracking";

const face=(x=.5,y=.48)=>[{x,y:y+.01},{x:x-.12,y:y-.06},{x:x+.12,y:y-.06},{x,y:y-.2},{x,y:y+.2}];
describe("local Jarvis focus",()=>{
  it("follows actual position and supports camera direction calibration",()=>{
    expect(gazeFromFace(face(.7),false,1000)?.x).toBeGreaterThan(.5);
    expect(gazeFromFace(face(.7),true,1000)?.x).toBeLessThan(-.5);
    expect(gazeFromFace(face(.5,.65),false,1000)?.y).toBeGreaterThan(.4);
    expect(gazeFromFace(face(),false,1000)?.x).toBeCloseTo(0);
  });
  it("rejects malformed, absent and degenerate observations",()=>{
    expect(gazeFromFace([],false,1000)).toBeNull();
    expect(gazeFromFace(face(NaN),false,1000)).toBeNull();
    const points=face();points[2]=points[1];expect(gazeFromFace(points,false,1000)).toBeNull();
  });
  it("holds an occluded person briefly, then relaxes without inventing tracking",()=>{
    const target={x:.7,y:.3,roll:.1,seen:1000};
    expect(currentGaze(target,1800).x).toBe(.7);
    expect(currentGaze(target,2800).x).toBeGreaterThan(0);
    expect(currentGaze(target,2800).x).toBeLessThan(.7);
    expect(currentGaze(target,3700)).toEqual(neutralGaze());
  });
  it("eyes can lead the head with frame-rate independent damping",()=>{
    expect(damp(0,1,16,1/60)).toBeGreaterThan(damp(0,1,4,1/60));
    const two=damp(damp(0,1,4,1/60),1,4,1/60);
    expect(two).toBeCloseTo(damp(0,1,4,1/30),8);
    expect(damp(0,1,4,30)).toBeLessThan(.5);
  });
});
