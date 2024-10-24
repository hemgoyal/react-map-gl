import * as turf from "@turf/turf";
import { message } from "antd";

const getBoundary = (polygon, line, direction, id, properties) => {
  try {
    const polyCoords = [];
    const cutPolyGeoms = [];
    const intersectPoints = turf.lineIntersect(polygon, line);

    let retVal = null;
    let j;

    const nPoints = intersectPoints.features.length;
    if ((nPoints == 0) || ((nPoints % 2) != 0)) return retVal;

    const offsetLine = turf.lineOffset(line, (0.01 * direction), {units: 'kilometers'});

    for (j = 0; j < line.geometry.coordinates.length; j++) {
      polyCoords.push(line.geometry.coordinates[j]);
    }
    for (j = (offsetLine.geometry.coordinates.length - 1); j >= 0; j--) {
      polyCoords.push(offsetLine.geometry.coordinates[j]);
    }
    polyCoords.push(line.geometry.coordinates[0]);
    const thickLineString = turf.lineString(polyCoords);
    const thickLinePolygon = turf.lineToPolygon(thickLineString);   

    const clipped = turf.difference({
      type: "FeatureCollection",
      features: [polygon, thickLinePolygon]
    });  
    for (j = 0; j < clipped.geometry.coordinates.length; j++) {
      const polyg = turf.polygon(clipped.geometry.coordinates[j]);
      const overlap = turf.lineOverlap(polyg, line, {tolerance: 0.005});
      if (overlap.features.length > 0) {
        cutPolyGeoms.push(polyg.geometry.coordinates);
      };
    };

    const featureProperties = {
      id: id,
      name: properties.name,
      district: properties.district,
      type: "SplittedFeature"
    }

    if (cutPolyGeoms.length === 1)
      retVal = turf.polygon(cutPolyGeoms[0], featureProperties);
    else if (cutPolyGeoms.length > 1) {
      retVal = turf.multiPolygon(cutPolyGeoms, featureProperties);
    }

    return retVal;
  } catch(e) {
    console.log('dfsdfsdfd: ', e);
  }
};

const getNewlyAddedFeatures = (featureList = { features: [] }) => {
  const newFeatures = [];
  const { features = [] } = featureList;

  for (const feature of features) {
    if (feature.geometry.type !== "LineString") {
      newFeatures.push(feature);
    }
  }

  return newFeatures;
}

export const handleSplit = ({
  lineFeature, draw, allData, onSplit
}) => {
  try {
    // Ensure the drawn line is of type 'LineString'
    if (lineFeature.geometry.type !== "LineString") {
      draw.delete(lineFeature.id);
      message.error("The feature must be a LineString. Please draw line string.");

      return;
    }

    const line = turf.lineString(
      lineFeature.geometry.coordinates,
      {'stroke-width': 6, stroke: '#ff0000'}
    );

    let intersectingFeature = null;

    const splittedBoundaries = getNewlyAddedFeatures(draw.getAll()); 

    // Check against splittedBoundaries first, fallback to original allData
    const featuresToCheck = splittedBoundaries.length > 0 ? splittedBoundaries : allData;

    // Loop through all features and find which polygon the line intersects
    for (const feature of featuresToCheck) {
      const polygon = turf.polygon(feature.geometry.coordinates, {
        stroke: '#0FF', fill: '#0FF', 'fill-opacity': 0.3, 'stroke-width': 6
      });

      // Find the intersection points between the line and the polygon
      const intersectPoints = turf.lineIntersect(line, polygon);

      // Additional check to ensure line intersects in at least two distinct points
      if (intersectPoints.features.length >= 2) {
        // Ensure that the line either:
        // 1. Starts outside and ends inside
        // 2. Starts inside and ends outside
        // This guarantees that the line crosses the polygon boundary
        intersectingFeature = feature;
        break;
      }
    }

    // If no intersecting polygon was found, alert the user
    if (!intersectingFeature) {
      draw.delete(lineFeature.id);
      message.error(
        'The line does not intersect any polygon boundary or you are currently editing any sector. Please check.'
      );
      return;
    }

    const polygon = turf.polygon(
      intersectingFeature.geometry.coordinates,
      {stroke: '#0FF', fill: '#0FF', 'fill-opacity': 0.3, 'stroke-width': 6}
    );

    // Check if the line crosses the polygon
    // const doesIntersect = turf.booleanCrosses(line, polygon);

    if (intersectingFeature.properties.type === "SplittedFeature") {
      draw.delete(intersectingFeature.id);
    }

    // New logic
    const upperPolygon = getBoundary(polygon, line, 1, "upper", intersectingFeature.properties);
    const lowerPolygon = getBoundary(polygon, line, -1, "lower", intersectingFeature.properties);
    // new logic end here

    // Split the polygon using the drawn line
    // const split = turf.lineSplit(line, polygon);
    // const features = split.features;
    if (!upperPolygon || !lowerPolygon) {
      draw.delete(lineFeature.id);
      message.error(
        'Error while splitting the boundary. Please retry.'
      );
      return;
    }
    const updatedBoundaries = [
      ...splittedBoundaries.filter((f) => f !== intersectingFeature),
      upperPolygon,
      lowerPolygon
    ];

    console.log("updatedBoundaries: ", updatedBoundaries);

    onSplit(updatedBoundaries);
    // if (features.length > 1) {
    //   // setSplittedBoundaries(features); // Update the map with the split polygons
    //   onSplit([upperPolygon, lowerPolygon]);
    //   console.log("dffsdff: ", features);
    // } else {
    //   alert("Line does not split the boundary");
    // }
  } catch (error) {
    draw.delete(lineFeature.id);
    message.error("Draw line is not in any polygon boundary. Please draw an intersecting line.");
  }
};
