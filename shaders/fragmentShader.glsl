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
uniform vec3 fragColor;
uniform LightProperties lights[4];
uniform mat3 normalMatrix;

uniform bool testing;

varying vec2 uv_coords;
varying vec3 obj_coords;
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
    if (testing) {
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
        return;
    }

    //if (1==1) {
    //    vec2 c = vec2(0.5, 0.5);
    //    gl_FragColor = texture2D(u_texture, c);
    //    return;
    //}
    // Object has no normals, it's the triangle
    // Later WebGL's provide `isnan()`
    if (v_normal.z == 0.0 || v_normal.z < 0.0 || v_normal.z > 0.0) {
    } else {
        gl_FragColor = texture2D(u_texture, uv_coords);
        return;
    }

    vec4 texColor = vec4(1.0);
    vec3 lightColor = vec3(0.0);
    vec3 normal = normalize(normalMatrix * v_normal);
    vec3 viewDirection = normalize(-v_eyeCoords);

    // for simple 2D textures
    if (textured) {
        // sample from u_texture @ (uv_coords.x, uv_coords.y)
        if (texCube) {
             // I don't know why the coords need to be flipped again
            texColor = textureCube(u_textureCube, -obj_coords);
        } else {
            if (v_normal.z > 0.99999)  { // 1.0 caused a weird glitch
                texColor = texture2D(u_texture, uv_coords);
                //gl_FragColor = texture2D(u_texture, uv_coords);
            }
        }
    }
    //else {
    //    gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    //    return;
    //}

    if (!lit) {
        if (textured) {
            gl_FragColor = texColor;
            return;
        }
        gl_FragColor = vec4(fragColor, 1.0);
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
    gl_FragColor = vec4(finalRGB, 1.0);
}

