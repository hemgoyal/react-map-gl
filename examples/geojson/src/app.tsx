import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl';
import * as turf from "@turf/turf";
import MapboxDraw from '@mapbox/mapbox-gl-draw';

import DrawControl from './draw-control';
import LegandTable from './LegandTable';
import SelectionComponent from './SelectionComponent';

import MysuruGeoJson from "./Mysuru.json";
import GorakhpurGeoJson from "./Gorakhpur.json";

import { handleSplit } from "./utils";

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWJlcmRhdGEiLCJhIjoiY2pwY3owbGFxMDVwNTNxcXdwMms2OWtzbiJ9.1PPVl0VLUQgqrosrI2nUhg'; // Set your mapbox token here

export default function App() {
  const [allData, setAllData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [features, setFeatures] = useState({});
  const [splittedBoundaries, setSplittedBoundaries] = useState([]);
  const [clickedInfo, setClickedInfo] = useState(null);
  const viewPort = {
    latitude: 12.9339351,
    longitude: 77.6709449,
    zoom: 11
  };

  const mapRef = useRef();

  const draw = new MapboxDraw({
    position: "top-left",
    displayControlsDefault: false,
    controls: {
      line_string: true,
      trash: true,
      zoom_in: true,
      simple_select: true,
    },
    modes: {
      ...MapboxDraw.modes,
    },
  });

  const onHover = useCallback(event => {
    const {
      features,
      point: {x, y}
    } = event;
    const hoveredFeature = features && features[0];

    // prettier-ignore
    setHoverInfo(hoveredFeature && {feature: hoveredFeature, x, y});
  }, []);

  const onSplit = (features) => {
    setSplittedBoundaries(features);
    for (const feature of features) {
      draw.add(feature);
    }
    const allFeatues = draw.getAll();
    for (const feature of allFeatues.features) {
      if (feature.geometry.type === "LineString") {
        draw.delete(feature.id);
      }
    }
  }

  const onUpdate = useCallback(e => {
    setFeatures(currFeatures => {
      const newFeatures = {...currFeatures};
      for (const f of e.features) {
        newFeatures[f.id] = f;
      }
      return newFeatures;
    });
  }, []);

  const onCreate = (e) => {
    const drawnFeature = e.features[0];

    if (drawnFeature.geometry.type === "LineString") {
      handleSplit({
        lineFeature: drawnFeature,
        draw: draw,
        allData: allData.features,
        onSplit
      });
    }
  }

  const onDelete = useCallback(e => {
    console.log("sdfdsfdsf: ", e);
    // for (const f of e.features) {
    //   draw.delete(f.id);
    // }
    // setFeatures(currFeatures => {
    //   const newFeatures = {...currFeatures};
    //   for (const f of e.features) {
    //     delete newFeatures[f.id];
    //   }
    //   return newFeatures;
    // });
  }, []);
  
  useEffect(() => {
    if (!splittedBoundaries.length) {
      return;
    }
    const source = mapRef?.current?.getSource("boundary");
    const newData = {
      type: "FeatureCollection",
      features: [
        ...allData.features,
        ...splittedBoundaries
      ]
    }
    // source.setData(newData);
  }, [splittedBoundaries]);

  const handleLoadMap = (value) => {
    /* global fetch */
    let geoJson = {};
    if (value === "mysuru") {
      geoJson = MysuruGeoJson;
    } else {
      geoJson = GorakhpurGeoJson;
    }
    setAllData(geoJson);
    const bbox = turf.bbox(geoJson);

    // Set the map to fit the bounds of the geojson features
    mapRef?.current?.flyTo({
      center: [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2
      ],
      zoom: 10,
      duration: 2000
    });
  };

  const onClick = useCallback(event => {
    const {features, lngLat} = event;
    const clickedFeature = features && features[0];
    
    if (clickedFeature) {
      setClickedInfo({
        feature: clickedFeature,
        lngLat
      });
    }
  }, []);

  // console.log("mapRef: ", mapRef.current);

  useEffect(() => {
    if (!allData) return;

    mapRef.current.addControl(draw, "top-left");

    mapRef.current.on('draw.create', onCreate);
    mapRef.current.on('draw.delete', onDelete);
  }, [allData]);

  return (
    <Map
      ref={mapRef}
      initialViewState={viewPort}
      reuseMaps
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
      interactiveLayerIds={['population', 'split-layer']}
      onMouseMove={onHover}
      // onClick={onClick}
    >
      <Source id="boundary" type="geojson" data={allData}>
        <Layer
          id="boundary-outline"
          type="line"
          paint={{
            "line-color": "#000",
            "line-width": 3
          }}
        />
        <Layer
          id="population"
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['<=', ['get', 'population'], 7999], '#00FF00',
              ['<=', ['get', 'population'], 19999], '#F098EE',
              ['<=', ['get', 'population'], 49999], '#8CC0E6',
              ['<=', ['get', 'population'], 99999], '#86EC93',
              ['<=', ['get', 'population'], 499999], '#FEED6C',
              ['>=', ['get', 'population'], 500000], '#FE7F70',
              '#00FF00' // blue for population > 10000
            ],
            'fill-opacity': 0.6
          }}
        />
        <Layer
          id="population-label"
          type="symbol"
          layout={{
            'text-field': ['get', 'name'],  // Display population value
            'text-size': 12,                      // Text size
            'text-offset': [0, 1.5],              // Adjust position of text relative to point
            'text-anchor': 'top'                  // Anchor point of the label
          }}
          paint={{
            'text-color': '#000000',               // Label color
            'text-halo-color': '#FFFFFF',          // Outline color for readability
            'text-halo-width': 1                   // Outline thickness
          }}
        />
      </Source>
      {splittedBoundaries.length > 0 && (
        <Source
          id="split-polygons"
          type="geojson"
          data={{
            type: "FeatureCollection",
            features: splittedBoundaries,
          }}
        >
          <Layer
            id="split-layer"
            type="fill"
            paint={{
              'fill-color': [
                'match',
                ['get', 'id'],   // Dynamic styling based on 'category' property
                'upper', '#000',     // Green for parks
                'lower', '#000',    // Blue for water
                '#000'
              ],
              'fill-opacity': 0.6
            }}
          />
          <Layer
            id="splitted-boundary-outline"
            type="line"
            paint={{
              "line-color": "#fff",
              "line-width": 3
            }}
          />
        </Source>
      )}
      <NavigationControl position="top-left" />
      {/* {
        allData ? (
          <DrawControl
            // key={JSON.stringify(splittedBoundaries)}
            position="top-left"
            displayControlsDefault={false}
            controls={{
              line_string: true,
              trash: true,
              zoom_in: true,
            }}
            onCreate={onUpdate}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onSplit={onSplit}
            splittedBoundaries={splittedBoundaries}
            allData={allData.features}
          />
        ) : null
      } */}
      {hoverInfo && (
        <div className="tooltip" style={{left: hoverInfo.x, top: hoverInfo.y}}>
          <div>Name: {hoverInfo.feature.properties.name}</div>
          <div>District: {hoverInfo.feature.properties.district}</div>
          <div>State: {hoverInfo.feature.properties.state}</div>
          <div>Id: {hoverInfo.feature.properties.id}</div>
          <div>Population: {hoverInfo.feature.properties.population}</div>
          <div>Layer: {hoverInfo.feature.properties.layer}</div>
        </div>
      )}

      {clickedInfo && (
        <Popup
          longitude={clickedInfo.lngLat.lat}
          latitude={clickedInfo.lngLat.lng}
          onClose={() => setClickedInfo(null)}
          anchor="top"
          closeOnClick={true}
        >
          <div>
            <div><strong>Name:</strong> {clickedInfo.feature.properties.name}</div>
            <div><strong>District:</strong> {clickedInfo.feature.properties.district}</div>
            <div><strong>State:</strong> {clickedInfo.feature.properties.state}</div>
            <div><strong>Population:</strong> {clickedInfo.feature.properties.population}</div>
          </div>
        </Popup>
      )}

      <LegandTable />

      <SelectionComponent
        handleLoadMap={handleLoadMap}
      />
    </Map>
  );
}

export function renderToDom(container) {
  createRoot(container).render(<App />);
}
