precision mediump float;

struct LightProperties {
    bool enabled;
    vec4 position;              // light eye-coord position
    vec3 color;
    vec3 spotDirection;
    float spotCutoff;           // spotlight limit angle
    float spotExponent;         // spotlight intensity falloff
};

struct MaterialProperties {
    vec3 diffuseColor;
    vec3 specularColor;
    float specularExponent; // specular intensity falloff
};

uniform sampler2D u_texture;
uniform bool textured;

varying vec4 fragColor;
varying vec2 uv_coords;
varying vec3 transformMat_display;

vec3 lightingEquation(LightProperties light,
                      MaterialProperties material,
                      vec3 position, // eye-coordinates of the point
                      vec3 N,
                      vec3 V) {
    vec3 L; // light-to-point vector
    vec3 R; // light reflection vector

    if (light.position.w == 0.0) { // directional light
        L = normalize(light.position.xyz);
    } else { // point light
        L = normalize(light.position.xyz/light.position.w - position.xyz);
    }

    if (dot(L, N) <= 0.0) { // check vector alignment > 0
        return vec3(0.0);
    }

    vec3 reflection = dot(L, N) * light.color * material.diffuseColor;
    R = reflect(L, N);

    if (dot(R, V) > 0.0) {
        float factor = pow( dot(R, V), material.specularExponent);
        reflection += factor * material.specularColor * light.color;
    }

    return reflection;
}

void main() {
    if (textured) {
        // sample from u_texture @ (uv_coords.x, uv_coords.y)
        gl_FragColor = texture2D(u_texture, uv_coords);
    } else {
        gl_FragColor = fragColor;
    }

    // how to debug shaders apparently
    //gl_FragColor = vec4(transformMat_display, 1.0);
}
