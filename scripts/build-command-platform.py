"""Build an independent, lightweight Blender scene; preserve the user's active scene.
Run in Blender with OUTPUT_DIR set to the application's public/models directory.
"""
import bpy, math, os
from mathutils import Vector

original_scene = bpy.context.scene
scene = bpy.data.scenes.new('Hermes_Command_R37')
def material(name, rgb, metallic=.65, roughness=.32, emission=0):
    m=bpy.data.materials.new('R37_'+name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=roughness
    p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m
graphite=material('Graphite',(.035,.058,.079));edge=material('BrushedTitanium',(.16,.21,.25),.8)
gold=material('Champagne',(.58,.39,.19),.78);light=material('PearlLight',(.32,.66,.75),.3,emission=1.5)
glass=material('ConsoleInk',(.006,.015,.023),.25,.18)
def mesh(name,vertices,faces,mat,bevel=0):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=3
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj
def sector(name,ri,ro,a0,a1,z,height,mat,bevel=.018):
    n=max(12,int((a1-a0)*28));v=[]
    for k in range(n+1):
        a=a0+(a1-a0)*k/n
        for r,h in [(ri,z),(ro,z),(ri,z+height),(ro,z+height)]:v.append((math.cos(a)*r,math.sin(a)*r,h))
    f=[]
    for k in range(n):
        j=k*4;f.extend([(j,j+4,j+5,j+1),(j+2,j+3,j+7,j+6),(j,j+2,j+6,j+4),(j+1,j+5,j+7,j+3)])
    f.extend([(0,1,3,2),(n*4,n*4+2,n*4+3,n*4+1)])
    return mesh(name,v,f,mat,bevel)
for i in range(3):
    a=i*math.tau/3+.12;b=a+math.tau/3-.3
    sector('Terrace_%d'%i,1.65,4.75,a,b,-.24,.22,graphite,.04)
    sector('Outer_rail_%d'%i,4.66,4.76,a+.02,b-.02,-.02,.1,edge)
    sector('Light_inlay_%d'%i,4.56,4.585,a+.04,b-.04,-.009,.008,light,0)
    sector('Inner_trim_%d'%i,1.65,1.70,a+.02,b-.02,-.01,.04,gold,.006)
    for j in range(7):
        c=a+.1+j*(b-a-.2)/6
        sector('Radial_joint_%d_%d'%(i,j),2.0,4.45,c,c+.008,-.004,.004,edge,0)
sector('Core_cradle',.35,1.15,0,math.tau,-.26,.22,graphite,.04)
sector('Core_trim',1.02,1.06,0,math.tau,-.02,.035,gold,.006)
def box(name,location,scale,mat,bevel=.05):
    v=[(x*scale[0]/2+location[0],y*scale[1]/2+location[1],z*scale[2]/2+location[2]) for z in [-1,1] for y in [-1,1] for x in [-1,1]]
    return mesh(name,v,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],mat,bevel)
for i,x in enumerate([-2.3,0,2.3]):
    y=-3.55 if i!=1 else -4.15
    box('Console_%d'%i,(x,y,.3),(1.55,.8,.46),graphite)
    box('Console_top_%d'%i,(x,y,.55),(1.4,.68,.055),glass,.025)
    box('Console_edge_%d'%i,(x,y-.35,.52),(1.20,.025,.02),light,.005)
for i,x in enumerate([-3.6,3.6]):
    box('Rear_beacon_%d'%i,(x,1.8,.9),(.10,.14,1.7),edge,.02)
    box('Beacon_inlay_%d'%i,(x,1.72,.9),(.036,.015,1.5),light,.003)
os.makedirs(OUTPUT_DIR,exist_ok=True)
with bpy.context.temp_override(scene=scene):
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUTPUT_DIR,'hermes-command-r37.glb'),use_active_scene=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
if bpy.context.window:
    bpy.context.window.scene=original_scene
print('Exported separate scene:',scene.name,'objects:',len(scene.objects),'active scene:',bpy.context.scene.name)
