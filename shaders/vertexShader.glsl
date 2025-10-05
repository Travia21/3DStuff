#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform mat4 transformMatrix;
uniform mat4 modelview;
uniform mat4 projection;
uniform bool textured;

attribute vec2 tex_coords;
attribute vec4 color;
attribute vec3 position;

varying vec4 fragColor;
varying vec2 uv_coords;

varying vec3 transformMat_display;

void main() {
    mat4 modelviewProjection = projection * modelview;
    vec4 transformedPos = transformMatrix * vec4(position, 1.0);

    // how to debug shaders apparently
    //transformMat_display = vec3(transformMat[0][0], transformMat[1][1], transformMat[2][2]);

    uv_coords = tex_coords;
    fragColor = color;
    //fragColor = vec4(1.0);
    //gl_Position = modelviewProjection * transformedPos;
    gl_Position = projection * modelview * transformMatrix * vec4(position, 1.0);
}
