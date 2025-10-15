#version 300 es

#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform bool texCube;
uniform mat4 modelview;
uniform mat4 projection;

in vec3 position;
in vec3 a_normal;
in vec2 tex_coords;

out vec3 v_eyeCoords;
out vec3 v_normal;
out vec2 uv_coords;
out vec3 obj_coords;

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
