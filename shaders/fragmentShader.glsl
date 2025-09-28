precision mediump float;

uniform sampler2D u_texture;

varying vec4 fragColor;
varying vec2 uv_coords;

void main() {
    //gl_FragColor = fragColor;
    gl_FragColor = texture2D(u_texture, uv_coords);
}
