import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl';
import * as turf from "@turf/turf";
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Modal, message } from 'antd';

import DrawControl from './draw-control';
import LegandTable from './LegandTable';
import SelectionComponent from './SelectionComponent';
import ResetControl from "./ResetControl";

import MysuruGeoJson from "./Mysuru.json";
import GorakhpurGeoJson from "./Gorakhpur.json";

import { handleSplit } from "./utils";

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWJlcmRhdGEiLCJhIjoiY2pwY3owbGFxMDVwNTNxcXdwMms2OWtzbiJ9.1PPVl0VLUQgqrosrI2nUhg'; // Set your mapbox token here

export default function App() {
  const [allData, setAllData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [splittedBoundaries, setSplittedBoundaries] = useState([]);
  const [clickedInfo, setClickedInfo] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState([]);
  const [isControlInitialized, setIsControlInitialized] = useState(false);
  const viewPort = {
    latitude: 12.9339351,
    longitude: 77.6709449,
    zoom: 11
  };

  const mapRef = useRef();
  const drawRef = useRef();
  const allDataRef = useRef();

  useEffect(() => {
    if (drawRef.current) return;

    drawRef.current = new MapboxDraw({
      position: "top-left",
      displayControlsDefault: false,
      controls: {
        line_string: true,
        trash: true
      },
      modes: {
        ...MapboxDraw.modes,
        simple_select: {
          ...MapboxDraw.modes.simple_select,
          onDrag: () => {}
        },
        direct_select: {
          ...MapboxDraw.modes.direct_select,
          onVertex: () => {},
          onMidpoint: () => {},
          dragVertex: () => {},
        }
      },
      styles: [
        {
          "id": "gl-draw-line",
          "type": "line",
          "filter": ["all", ["==", "$type", "LineString"]],
          "layout": {
            "line-cap": "round",
            "line-join": "round"
          },
          "paint": {
            "line-color": "#D20C0C",
            "line-dasharray": [0.2, 2],
            "line-width": 3
          }
        },
        // polygon fill
        {
          "id": "gl-draw-polygon-fill",
          "type": "fill",
          "filter": ["all", ["==", "$type", "Polygon"]],
          "paint": {
            "fill-color": "#000",
            "fill-outline-color": "#000",
            "fill-opacity": 0.6
          }
        },
        {
          "id": "gl-draw-polygon-fill-selected",
          "type": "fill",
          "filter": [
            "all",
            ['==', 'active', 'true'],
            ["==", "$type", "Polygon"]
          ],
          "paint": {
            "fill-color": "#000",
            "fill-outline-color": "#000",
            "fill-opacity": 0.7
          }
        },
        // polygon mid points
        {
          'id': 'gl-draw-polygon-midpoint',
          'type': 'circle',
          'filter': ['all',
            ['==', '$type', 'Point'],
            ['==', 'meta', 'midpoint']],
          'paint': {
            'circle-radius': 3,
            'circle-color': '#fbb03b'
          }
        },
        // polygon outline stroke
        // This doesn't style the first edge of the polygon, which uses the line stroke styling instead
        {
          "id": "gl-draw-polygon-stroke-active",
          "type": "line",
          "filter": ["all", ["==", "$type", "Polygon"]],
          "layout": {
            "line-cap": "round",
            "line-join": "round"
          },
          "paint": {
            "line-color": "#fff",
            "line-width": 3
          }
        },
        // vertex point halos
        {
          "id": "gl-draw-polygon-and-line-vertex-halo-active",
          "type": "circle",
          "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
          "paint": {
            "circle-radius": 5,
            "circle-color": "#FFF"
          }
        },
        // vertex points
        {
          "id": "gl-draw-polygon-and-line-vertex-active",
          "type": "circle",
          "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
          "paint": {
            "circle-radius": 3,
            "circle-color": "#000",
          }
        }
      ]
    });
  }, []);

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
      drawRef.current.add(feature);
    }
    const allFeatues = drawRef.current.getAll();
    for (const feature of allFeatues.features) {
      if (feature.geometry.type === "LineString") {
        drawRef.current.delete(feature.id);
      }
    }
  }

  const onCreate = (e) => {
    const drawnFeature = e.features[0];

    if (drawnFeature.geometry.type === "LineString") {
      handleSplit({
        lineFeature: drawnFeature,
        draw: drawRef.current,
        allData: allDataRef.current.features,
        onSplit
      });
    }
  }

  const onDelete = (e) => {
    // setIsModalOpen(true);
    setSelectedFeature(e.features);
    handleDelete(e);
  };

  const handleDelete = (e) => {
    // const selectedFeature = drawRef.current.getSelectedIds();
    for (const f of e.features) {
      drawRef.current.delete(f.id);
    }
    const allBoundaries = drawRef.current.getAll();
    setSplittedBoundaries(allBoundaries.features);
    setIsModalOpen(false);
    message.success("Boundary deleted successfully.");
  }

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedFeature([]);
  };
  
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
    if (splittedBoundaries.length > 0) {
      drawRef.current.deleteAll();
      setSplittedBoundaries([]);
    }
    /* global fetch */
    let geoJson = {};
    if (value === "mysuru") {
      geoJson = MysuruGeoJson;
    } else {
      geoJson = GorakhpurGeoJson;
    }
    setAllData(geoJson);
    allDataRef.current = geoJson;
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

  const onReset = () => {
    drawRef.current.deleteAll();
    setSplittedBoundaries([]);
  }

  useEffect(() => {
    if (!allData || isControlInitialized) return;

    setIsControlInitialized(true);
    mapRef.current.addControl(drawRef.current, "top-left");

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
        </Source>
      )}
      <NavigationControl position="top-left" />

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

      <Modal
        title="Are you sure you want to delete this sector?"
        open={isModalOpen}
        onOk={handleDelete}
        onCancel={handleCancel}
      />

      {splittedBoundaries.length > 0 && (
        <ResetControl
          onReset={onReset}
        />
      )}
    </Map>
  );
}

export function renderToDom(container) {
  createRoot(container).render(<App />);
}
