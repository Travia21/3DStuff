"use strict";

/**
 * This was a beast to build. I still don't know why I treat the caps as a special case
 * if I'm not able to use TRIANGLE_FAN
 * 
 * @param {*} radius 
 * @param {*} segments 
 * @param {*} circles 
 * @returns 
 */
// Finish converting this to glMatrix
export function sphere(radius, segments, circles, position = [0,0,0]) {
    let vertexBuffer = [];

    let PI = Math.PI;
    let phi = PI / circles;

    // Draw the poles
    let poles = 2;
    let r = radius * Math.sin(phi); // triangle hypotenuse
    let pole = new THREE.Vector3(0,0,radius);

    while (poles > 0) {
        poles--;
        let z = radius * -Math.cos(phi + PI);

        for (let segment = 0; segment <= segments; segment+=2) {
            let thetaCurr = (segment+0) * (2*PI / segments);
            let thetaNext = (segment+1) * (2*PI / segments);

            let x1 = r * Math.cos(thetaCurr);
            let y1 = r * Math.sin(thetaCurr);

            let x2 = r * Math.cos(thetaNext);
            let y2 = r * Math.sin(thetaNext);

            vertexBuffer.push( pole.x,pole.y,pole.z, x1,y1,z1, x2,y2,z2 );
        }

        pole.z *= -1; // invert the radius to draw the other pole
    }

    // Draw the bands of the sphere
    for (let circle = 1; circle < circles; circle++) {
        let phiCurr = (circle+0) * phi;
        let phiNext = (circle+1) * phi;

        let radiusCurr = radius * Math.sin(phiCurr);
        let radiusNext = radius * Math.sin(phiNext);

        var z1 = radius * -Math.cos(phiCurr);
        var z2 = radius * -Math.cos(phiNext);

        for (let segment = 0; segment <= segments; segment++) {
            console.log("circle: " + circle + "\tsegment: " + segment);
            let thetaCurr = (segment+0) * 2*PI / segments;
            let thetaNext = (segment+1) * 2*PI / segments;

            //point 1
            let p1x = radiusCurr * Math.cos(thetaCurr) + position[0];
            let p1y = radiusCurr * Math.sin(thetaCurr) + position[1];
            let p1z = z1 + position[2];

            //point 2
            let p2x = radiusNext * Math.cos(thetaCurr) + position[0];
            let p2y = radiusNext * Math.sin(thetaCurr) + position[1];
            let p2z = z2 + position[2];

            //point 3
            let p3x = radiusNext * Math.cos(thetaNext) + position[0];
            let p3y = radiusNext * Math.sin(thetaNext) + position[1];
            let p3z = z2 + position[2];

            //point 4
            let p4x = radiusCurr * Math.cos(thetaNext) + position[0];
            let p4y = radiusCurr * Math.sin(thetaNext) + position[1];
            let p4z = z1 + position[2];

            /*
            Update to use Indexed Face Set
            */
            vertexBuffer.push(
                p3x,p3y,p3z, p2x,p2y,p2z, p1x,p1y,p1z,
                p3x,p3y,p3z, p1x,p1y,p1z, p4x,p4y,p4z );
        }
    }

    let sphereGeo = new THREE.BufferGeometry();
    sphereGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertexBuffer, 3));
    sphereGeo.computeVertexNormals();

    let sphereMat = new THREE.MeshPhongMaterial( {
        color: 0x00aa77,
        specular: 0xffffff,
        side: THREE.FrontSide,
        flatShading: false // I can't tell the difference
    });

    return new THREE.Mesh(sphereGeo, sphereMat);
}

/**
 * Copied from the book text
 */
export function uvSphere(radius, slices, stacks) {
   radius = radius || 0.5;
   slices = slices || 32;
   stacks = stacks || 16;

   var vertexCount = (slices+1)*(stacks+1);

   var vertices = new Float32Array( 3*vertexCount );
   var normals = new Float32Array( 3* vertexCount );
   var texCoords = new Float32Array( 2*vertexCount );
   var indices = new Uint16Array( 2*slices*stacks*3 );

   var du = 2*Math.PI/slices;
   var dv = Math.PI/stacks;

   var i,j,u,v,x,y,z;
   var indexV = 0;
   var indexT = 0;

   for (i = 0; i <= stacks; i++) {
      v = -Math.PI/2 + i*dv;
      for (j = 0; j <= slices; j++) {
         u = j*du;

         x = Math.cos(u)*Math.cos(v);
         y = Math.sin(u)*Math.cos(v);
         z = Math.sin(v);

         // set index x value
         vertices[indexV] = radius*x;
         normals[indexV++] = x;

         // set index y value
         vertices[indexV] = radius*y;
         normals[indexV++] = y;

         // set index z value
         vertices[indexV] = radius*z;
         normals[indexV++] = z;

         texCoords[indexT++] = j/slices;
         texCoords[indexT++] = i/stacks;
      } 
   }

   var k = 0;
   for (j = 0; j < stacks; j++) {
      var row1 = j*(slices+1);
      var row2 = (j+1)*(slices+1);
      for (i = 0; i < slices; i++) {
          indices[k++] = row1 + i;
          indices[k++] = row2 + i + 1;
          indices[k++] = row2 + i;
          indices[k++] = row1 + i;
          indices[k++] = row1 + i + 1;
          indices[k++] = row2 + i + 1;
      }
   }
   return {
       vertexPositions: vertices,
       vertexNormals: normals,
       vertexTextureCoords: texCoords,
       indices: indices
   };
}
