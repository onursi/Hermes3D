"""Render a truthful, reproducible build replay of the R37 command platform.

This script never records the desktop. It opens the existing independent Blender
asset in background mode, stages its original objects by construction group and
saves a separate animated .blend plus a low-resolution vertical MP4 preview.

Usage:
  blender -b <Hermes-Kommandozentrale-R37.blend> --python \
    scripts/render-command-build-replay.py -- <output-directory>
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def output_directory() -> Path:
    args = sys.argv
    if "--" not in args or len(args) <= args.index("--") + 1:
        raise RuntimeError("Missing output directory after --")
    target = Path(args[args.index("--") + 1]).resolve()
    target.mkdir(parents=True, exist_ok=True)
    return target


def set_if_available(owner, name: str, value) -> None:
    if hasattr(owner, name):
        setattr(owner, name, value)


def make_material(name: str, color: tuple[float, float, float, float], emission: float = 0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Metallic"].default_value = 0.72
        principled.inputs["Roughness"].default_value = 0.25
        principled.inputs["Emission Color"].default_value = color
        principled.inputs["Emission Strength"].default_value = emission
    return material


def role_for(name: str) -> tuple[int, tuple[float, float, float, float]]:
    if name.startswith(("Core_",)):
        return 22, (0.18, 0.85, 1.0, 1.0)
    if name.startswith("Terrace_"):
        return 42, (0.08, 0.16, 0.23, 1.0)
    if name.startswith(("Outer_rail", "Inner_trim", "Radial_joint")):
        return 70, (0.86, 0.58, 0.25, 1.0)
    if name.startswith("Light_inlay"):
        return 96, (0.18, 0.92, 1.0, 1.0)
    if name.startswith(("Console_", "Console_top", "Console_edge")):
        return 122, (0.22, 0.66, 0.84, 1.0)
    if name.startswith(("Rear_beacon", "Beacon_inlay")):
        return 150, (0.92, 0.72, 0.34, 1.0)
    return 166, (0.42, 0.72, 0.82, 1.0)


def add_blueprint_grid(scene: bpy.types.Scene) -> None:
    curve = bpy.data.curves.new("R39_BlueprintGrid", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.009
    curve.bevel_resolution = 1
    for index in range(-7, 8):
        for axis in range(2):
            spline = curve.splines.new("POLY")
            spline.points.add(1)
            if axis == 0:
                points = ((-7.0, index, -0.34, 1.0), (7.0, index, -0.34, 1.0))
            else:
                points = ((index, -7.0, -0.34, 1.0), (index, 7.0, -0.34, 1.0))
            spline.points[0].co = points[0]
            spline.points[1].co = points[1]
    obj = bpy.data.objects.new("R39_BlueprintGrid", curve)
    scene.collection.objects.link(obj)
    grid_mat = make_material("R39_Grid", (0.025, 0.22, 0.29, 1.0), 0.25)
    curve.materials.append(grid_mat)


def add_camera(scene: bpy.types.Scene) -> None:
    camera_data = bpy.data.cameras.new("R39_ReplayCamera")
    camera_data.lens = 47
    camera_data.sensor_width = 32
    camera = bpy.data.objects.new("R39_ReplayCamera", camera_data)
    scene.collection.objects.link(camera)
    target = bpy.data.objects.new("R39_CameraTarget", None)
    target.empty_display_type = "PLAIN_AXES"
    target.location = (0.0, 0.0, 0.12)
    scene.collection.objects.link(target)
    constraint = camera.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    for frame, position, lens in (
        (1, (8.4, -11.8, 8.6), 50),
        (62, (10.6, -6.8, 6.2), 48),
        (118, (7.3, 8.6, 5.2), 45),
        (166, (-8.8, 7.0, 4.7), 43),
        (192, (-6.1, -10.2, 7.1), 46),
    ):
        camera.location = position
        camera.data.lens = lens
        camera.keyframe_insert("location", frame=frame)
        camera.data.keyframe_insert("lens", frame=frame)
    scene.camera = camera


def stage_original_objects(scene: bpy.types.Scene) -> int:
    original_objects = [
        obj
        for obj in scene.objects
        if obj.type in {"MESH", "CURVE"} and not obj.name.startswith("R39_")
    ]
    original_objects.sort(key=lambda obj: (role_for(obj.name)[0], obj.name))
    for sequence, obj in enumerate(original_objects):
        stage_start, display_color = role_for(obj.name)
        start = min(174, stage_start + (sequence % 7) * 2)
        settle = min(184, start + 12)
        final_location = obj.location.copy()
        final_scale = obj.scale.copy()
        lift = 0.70 if obj.name.startswith(("Console", "Rear", "Beacon")) else 0.38

        obj.color = display_color
        obj.hide_render = True
        obj.keyframe_insert("hide_render", frame=max(1, start - 1))
        obj.hide_render = False
        obj.keyframe_insert("hide_render", frame=start)
        obj.location = final_location - Vector((0.0, 0.0, lift))
        obj.scale = final_scale * 0.035
        obj.keyframe_insert("location", frame=start)
        obj.keyframe_insert("scale", frame=start)
        obj.location = final_location
        obj.scale = final_scale
        obj.keyframe_insert("location", frame=settle)
        obj.keyframe_insert("scale", frame=settle)

        # Blender's current layered action model uses Bezier interpolation by
        # default; no direct legacy fcurve traversal is required here.
    return len(original_objects)


def configure_render(scene: bpy.types.Scene, target: Path) -> None:
    scene.name = "Hermes_Command_R39_BuildReplay"
    scene.frame_start = 1
    scene.frame_end = 192
    scene.render.fps = 24
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("R39_ReplayWorld")
    scene.world.color = (0.002, 0.006, 0.012)

    shading = scene.display.shading
    set_if_available(shading, "light", "STUDIO")
    set_if_available(shading, "studio_light", "rim.sl")
    set_if_available(shading, "color_type", "OBJECT")
    set_if_available(shading, "background_type", "WORLD")
    set_if_available(shading, "show_shadows", True)
    set_if_available(shading, "show_cavity", True)
    set_if_available(shading, "cavity_type", "WORLD")
    set_if_available(shading, "curvature_ridge_factor", 1.8)
    set_if_available(shading, "curvature_valley_factor", 1.4)
    set_if_available(shading, "show_outline", True)
    set_if_available(shading, "outline_color", (0.06, 0.78, 0.96))

    # Blender 5.2 separates still-image and video output modes.
    set_if_available(scene.render.image_settings, "media_type", "VIDEO")
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.filepath = str(target / "Hermes_Command_R39_BuildReplay_Preview_9x16.mp4")


def main() -> None:
    target = output_directory()
    scene = bpy.context.scene
    configure_render(scene, target)
    add_blueprint_grid(scene)
    add_camera(scene)
    count = stage_original_objects(scene)
    blend_path = target / "Hermes_Command_R39_BuildReplay_v001.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    bpy.ops.render.render(animation=True)
    print(f"R39_BUILD_REPLAY_OK objects={count} blend={blend_path} video={scene.render.filepath}")


main()
