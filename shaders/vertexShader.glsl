precision mediump float;

uniform vec2 translation;

attribute vec2 position;
attribute vec4 color;

attribute float redder;

varying vec4 fragColor;

void main() {
    vec4 more_red = clamp(color + vec4(redder, 0.0, 0.0, 0.0), 0.0, 1.0);
    fragColor = more_red;
    gl_Position = vec4(position.x + translation.x, position.y + translation.y, 0.0, 1.0);
}
