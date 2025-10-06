#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

struct LightProperties {
    bool enabled;
    vec4 position;              // light eye-coord position
    vec3 color;
    vec3 spotDirection;         // spotlight pointing vector
    float spotCutoff;           // spotlight limit angle (radians)
    float spotExponent;         // spotlight intensity falloff
};

struct MaterialProperties {
    vec3 diffuseColor;
    vec3 specularColor;
    float specularExponent; // specular intensity falloff
};

uniform bool textured;
uniform sampler2D u_texture;
uniform MaterialProperties frontMaterial;
uniform MaterialProperties backMaterial;
uniform bool lit;
uniform vec3 fragColor;
uniform LightProperties lights[4];
uniform mat3 normalMatrix;

varying vec2 uv_coords;
varying vec3 v_normal;
varying vec3 v_eyeCoords;

vec3 lightingEquation(LightProperties light,
                      MaterialProperties material,
                      vec3 position, // eye-coordinates of the point
                      vec3 N, // normal vector
                      vec3 V  // spot to viewer vector
                      ) {
    vec3 L; // point-to-light vector
    vec3 R; // light reflection vector
    float spotFactor = 1.0; // spotlight intensity multiplier

    if (light.position.w == 0.0) { // directional light
        L = normalize(light.position.xyz);
    } else {
        L = normalize(light.position.xyz/light.position.w - position.xyz);
        if (light.spotCutoff > 0.0) { // light is spotlight
            vec3 D = -normalize(light.spotDirection); //light-to direction vector
            float spotCosine = dot(D, L); //angle between direction and light-to-point

            if (spotCosine >= cos(light.spotCutoff)) {
                spotFactor = pow(spotCosine, light.spotExponent);
            } else { // fragment outside spotlight cone
                spotFactor = 0.0; // light ignored
            }
        }
    }

    if (dot(L, N) <= 0.0) { // check vector alignment > 0
        return vec3(0.0);
    }

    vec3 reflection = dot(L, N) * light.color * material.diffuseColor;
    R = -reflect(L, N);

    if (dot(R, V) > 0.0) {
        float factor = pow( dot(R, V), material.specularExponent);
        reflection += factor * material.specularColor * light.color;
    }

    return spotFactor * reflection;
}

void main() {
    // for simple 2D textures
    if (textured) {
        // sample from u_texture @ (uv_coords.x, uv_coords.y)
        gl_FragColor = texture2D(u_texture, uv_coords);
        return;
    }

    if (!lit) {
        gl_FragColor = vec4(fragColor, 1.0);
        return;
    }

    vec3 normal = normalize(normalMatrix * v_normal);
    vec3 viewDirection = normalize(-v_eyeCoords);
    vec3 color = vec3(0.0);

    for (int i = 0; i < 4; i++) {
        if (lights[i].enabled) {
            if (gl_FrontFacing) {
                color += lightingEquation(lights[i], frontMaterial, v_eyeCoords, normal, viewDirection);
            } else {
                color += lightingEquation(lights[i], backMaterial, v_eyeCoords, -normal, viewDirection);
            }
        }
    }

    gl_FragColor = vec4(color, 1.0);
}

