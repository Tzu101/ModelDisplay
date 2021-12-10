export class SceneRender {

    static readFromJson(json) {

        try {
            let data = JSON.parse(json);
            let model = [];
            let normals = [];

            let points = data.vertices;
            let triangles = data.indices;
            let vectors = data.normals;

            for(let i=0; i < triangles.length; i++) {

                model.push(points[triangles[i]*3]);
                model.push(points[triangles[i]*3+1]);
                model.push(points[triangles[i]*3+2]);

                normals.push(vectors[triangles[i]*3]);
                normals.push(vectors[triangles[i]*3+1]);
                normals.push(vectors[triangles[i]*3+2]);
            }

            return [model, normals, data];
        }
        catch(error) {
            console.error(error);
        }
        return [null,  null];
    }
}
