precision mediump float;

uniform vec2 translation;

attribute vec2 position;
attribute vec2 tex_coords;
attribute vec4 color;

attribute float redder;

varying vec4 fragColor;
varying vec2 uv_coords;

void main() {
    vec4 more_red = clamp(color + vec4(redder, 0.0, 0.0, 0.0), 0.0, 1.0);
    fragColor = more_red;
    uv_coords = tex_coords;
    //gl_Position = vec4(position.x + translation.x, position.y + translation.y, 0.0, 1.0);
    gl_Position = vec4(position + translation, 0.0, 1.0);
}
