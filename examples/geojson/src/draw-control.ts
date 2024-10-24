import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl } from 'react-map-gl';
import * as turf from "@turf/turf";
import { useEffect, useRef } from 'react';

import type {ControlPosition} from 'react-map-gl';

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;

  onCreate?: (evt: {features: object[]}) => void;
  onUpdate?: (evt: {features: object[]; action: string}) => void;
  onDelete?: (evt: {features: object[]}) => void;
  splittedBoundaries: object[];
  allData: object[];
};

export default function DrawControl(props: DrawControlProps) {
  const drawRef = useRef<MapboxDraw | null>(null);

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

      if (cutPolyGeoms.length === 1)
        retVal = turf.polygon(cutPolyGeoms[0], {
          id: id,
          name: properties.name,
          district: properties.district,
        });
      else if (cutPolyGeoms.length > 1) {
        retVal = turf.multiPolygon(cutPolyGeoms, {
          id: id,
          name: properties.name,
          district: properties.district,
        });
      }

      return retVal;
    } catch(e) {
      console.log('dfsdfsdfd: ', e);
    }
  };

  const handleSplit = (lineFeature, splittedBoundaries, allData) => {
    try {
      // console.log("draw: ", draw);
      // Ensure the drawn line is of type 'LineString'
      if (lineFeature.geometry.type !== "LineString") {
        drawRef.current?.delete(lineFeature.id);
        alert("The feature must be a LineString. Deleting...");
        return;
      }

      const line = turf.lineString(
        lineFeature.geometry.coordinates,
        {'stroke-width': 6, stroke: '#ff0000'}
      );

      let intersectingFeature = null;

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
          const startPoint = turf.point(line.geometry.coordinates[0]);
          const endPoint = turf.point(line.geometry.coordinates[line.geometry.coordinates.length - 1]);

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
        drawRef.current?.delete(lineFeature.id);
        alert("The line does not intersect any polygon boundary. Try drawing a line across the polygon. Deleting...");
        return;
      }

      const polygon = turf.polygon(
        intersectingFeature.geometry.coordinates,
        {stroke: '#0FF', fill: '#0FF', 'fill-opacity': 0.3, 'stroke-width': 6}
      );

      // Debugging: Log line and polygon structure
      console.log("Line:", line);
      console.log("Polygon:", polygon);

      // Check if the line crosses the polygon
      // const doesIntersect = turf.booleanCrosses(line, polygon);

      // New logic
      const upperPolygon = getBoundary(polygon, line, 1, "upper", intersectingFeature.properties);
      const lowerPolygon = getBoundary(polygon, line, -1, "lower", intersectingFeature.properties);
      // new logic end here

      // Split the polygon using the drawn line
      // const split = turf.lineSplit(line, polygon);
      // const features = split.features;
      if (!upperPolygon || !lowerPolygon) {
        drawRef.current?.delete(lineFeature.id);
        alert("Error while splitting the boundary. Please retry.");
        return;
      }
      const updatedBoundaries = [
        ...splittedBoundaries.filter((f) => f !== intersectingFeature),
        upperPolygon,
        lowerPolygon
      ];

      props.onSplit(updatedBoundaries);
      // if (features.length > 1) {
      //   // setSplittedBoundaries(features); // Update the map with the split polygons
      //   props.onSplit([upperPolygon, lowerPolygon]);
      //   console.log("dffsdff: ", features);
      // } else {
      //   alert("Line does not split the boundary");
      // }
    } catch (error) {
      drawRef.current?.delete(lineFeature.id);
      console.error("Error while splitting the boundary:", error);
    }
  };

  const draw = useControl<MapboxDraw>(
    () => new MapboxDraw({
      modes: {
        ...MapboxDraw.modes,
      },
      ...props
    }),
    ({map}) => {
      drawRef.current = draw;
      map.on('draw.create', (e) => {
        const drawnFeature = e.features[0];
        console.log("props: ", props);
        if (drawnFeature.geometry.type === "LineString") {
          handleSplit(drawnFeature, props.splittedBoundaries, props.allData);
        } else {
          const inside = turf.booleanWithin(drawnFeature, props.allData);

          if (!inside) {
            alert("Polygon is outside the boundary. Deleting polygon...");
            draw.delete(drawnFeature.id);
            // draw.delete(drawnFeature.id);
          } else {
            props.onCreate(e);
          }
        }
      });
      map.on('draw.update', props.onUpdate);
      map.on('draw.delete', props.onDelete);
    },
    ({map}) => {
      map.off('draw.create', props.onCreate);
      map.off('draw.update', props.onUpdate);
      map.off('draw.delete', props.onDelete);
    },
    {
      position: props.position
    }
  );

  // UseEffect to handle prop updates (like splittedBoundaries, allData)
  useEffect(() => {
    if (!drawRef.current) return;

    const drawInstance = drawRef.current;

    // If you need to update specific properties of the draw instance
    drawInstance.set({
      modes: {
        ...MapboxDraw.modes,
        // You can add custom modes here if required
      },
    });

    // Re-attach event listeners or do other updates as needed
  }, [props.splittedBoundaries, props.allData, props.onCreate, props.onUpdate, props.onDelete]);

  return null;
}
