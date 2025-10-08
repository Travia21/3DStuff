#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform bool texCube;
uniform mat4 modelview;
uniform mat4 projection;

attribute vec3 position;
attribute vec3 a_normal;
attribute vec2 tex_coords;

varying vec3 v_eyeCoords;
varying vec3 v_normal;
varying vec2 uv_coords;
varying vec3 obj_coords;

void main() {
    vec4 coords = vec4(position, 1.0);
    vec4 eyeCoords = modelview * coords;

    if (texCube) {
        obj_coords = position;
    } else {
        uv_coords = tex_coords;
    }
    v_normal = normalize(a_normal);
    v_eyeCoords = eyeCoords.xyz/eyeCoords.w;

    gl_Position = projection * eyeCoords;
}
