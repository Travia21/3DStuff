precision mediump float;

uniform mat3 translation;
uniform mat3 transformMat;

attribute vec2 position;
attribute vec2 tex_coords;
attribute vec4 color;

attribute float redder;

varying vec4 fragColor;
varying vec2 uv_coords;

varying vec3 transformMat_display;

void main() {
    vec4 more_red = clamp(color + vec4(redder, 0.0, 0.0, 0.0), 0.0, 1.0);
    fragColor = more_red;

    uv_coords = tex_coords;
    vec3 translatedPos= vec3(position, 1.0) * translation;
    vec3 transformedPos = translatedPos * transformMat;

    // how to debug shaders apparently
    //transformMat_display = vec3(transformMat[0][0], transformMat[1][1], transformMat[2][2]);

    gl_Position = vec4(transformedPos.xy, 0.0, 1.0);
}

