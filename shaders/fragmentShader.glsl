#version 300 es

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
uniform bool texCube;
uniform sampler2D u_texture;
uniform samplerCube u_textureCube;
uniform MaterialProperties frontMaterial;
uniform MaterialProperties backMaterial;
uniform bool lit;
uniform LightProperties lights[4];
uniform mat3 normalMatrix;

uniform bool testing;

in vec2 uv_coords;
in vec3 obj_coords;
in vec3 v_normal;
in vec3 v_eyeCoords;

layout(location=0) out vec4 fragColor;

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
        if (light.spotCutoff != 0.0) { // light is spotlight
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
    fragColor = vec4(1.0, 0.0, 1.0, 1.0);
    if (testing) {
        return;
    }

    if (isnan(v_normal.z)) {
        fragColor = texture(u_texture, uv_coords);
        return;
    }

    vec4 texColor = vec4(1.0);
    vec3 lightColor = vec3(0.0);
    vec3 normal = normalize(normalMatrix * v_normal);
    vec3 viewDirection = normalize(-v_eyeCoords);

    if (textured) {
        if (texCube) {
             // I don't know why the coords need to be flipped again
            texColor = texture(u_textureCube, -obj_coords);
        } else {
            // rectanguloid display
            if (v_normal.z > 0.99999)  {
                fragColor = texture(u_texture, uv_coords);
                return;
            }
        }
    }

    if (!lit) {
        if (textured) {
            fragColor = texColor;
            return;
        }
        return;
    }

    for (int i = 0; i < 4; i++) {
        if (lights[i].enabled) {
            if (gl_FrontFacing) {
                lightColor += lightingEquation(lights[i], frontMaterial, v_eyeCoords, normal, viewDirection);
            } else {
                lightColor += lightingEquation(lights[i], backMaterial, v_eyeCoords, -normal, viewDirection);
            }
        }
    }

    vec3 finalRGB = texColor.rgb * lightColor;
    fragColor = vec4(finalRGB, 1.0);
}

