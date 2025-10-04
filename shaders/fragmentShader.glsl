precision mediump float;

uniform sampler2D u_texture;

varying vec4 fragColor;
varying vec2 uv_coords;
varying vec3 transformMat_display;

void main() {
    // sample from u_texture @ (uv_coords.x, uv_coords.y)
    gl_FragColor = texture2D(u_texture, uv_coords);

    // how to debug shaders apparently
    //gl_FragColor = vec4(transformMat_display, 1.0);
}

