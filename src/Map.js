import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { Draw } from 'ol/interaction';
import { LineString, Polygon } from 'ol/geom';
import { getArea, getLength } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import 'ol/ol.css';
import './Map.css'

const MapComponent = () => {
  const mapRef = useRef(null);
  const measureTooltipRef = useRef(null);
  const helpTooltipRef = useRef(null);
  const [drawType, setDrawType] = useState('LineString');

  useEffect(() => {
    const raster = new TileLayer({
      source: new OSM(),
    });

    const source = new VectorSource();

    const vector = new VectorLayer({
      source: source,
      style: new Style({
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.5)',
          lineDash: [10, 10],
          width: 2,
        }),
        image: new CircleStyle({
          radius: 5,
          stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.7)',
          }),
          fill: new Fill({
            color: 'rgba(255, 255, 255, 0.2)',
          }),
        }),
      }),
    });

    const map = new Map({
      layers: [raster, vector],
      target: mapRef.current,
      view: new View({
        center: [-11000000, 4600000],
        zoom: 15,
      }),
    });

    const style = new Style({
        fill: new Fill({
          color: 'rgba(255, 255, 0, 0.2)', // fill color for polygons
        }),
        stroke: new Stroke({
          color: 'rgba(255, 255, 0, 0.5)', // stroke color for lines and polygon outlines
          lineDash: [10, 10],
          width: 2,
        }),
        image: new CircleStyle({
          radius: 5,
          stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.7)', // stroke color for points
          }),
          fill: new Fill({
            color: 'rgba(255, 255, 0, 0.2)', //  fill color for points
          }),
        }),
      });
      
    const createHelpTooltip = () => {
      if (helpTooltipRef.current) {
        helpTooltipRef.current.parentNode.removeChild(helpTooltipRef.current);
      }
      const helpTooltip = document.createElement('div');
      helpTooltip.className = 'ol-tooltip hidden';
      helpTooltipRef.current = helpTooltip;
      mapRef.current.parentElement.appendChild(helpTooltip);
    };

    const createMeasureTooltip = () => {
      if (measureTooltipRef.current) {
        measureTooltipRef.current.parentNode.removeChild(measureTooltipRef.current);
      }
      const measureTooltip = document.createElement('div');
      measureTooltip.className = 'ol-tooltip ol-tooltip-measure';
      measureTooltipRef.current = measureTooltip;
      mapRef.current.parentElement.appendChild(measureTooltip);
    };

    const pointerMoveHandler = (evt) => {
      if (evt.dragging) {
        return;
      }
      let helpMsg = 'Click to start drawing';

      if (draw && draw.sketchFeature) {
        const geom = draw.sketchFeature.getGeometry();
        if (geom instanceof Polygon) {
          helpMsg = 'Click to continue drawing the polygon';
        } else if (geom instanceof LineString) {
          helpMsg = 'Click to continue drawing the line';
        }
      }

      helpTooltipRef.current.innerHTML = helpMsg;
      helpTooltipRef.current.style.display = 'block';
      helpTooltipRef.current.style.left = `${evt.pixel[0] + 15}px`;
      helpTooltipRef.current.style.top = `${evt.pixel[1]}px`;
    };

    const formatLength = (line) => {
      const length = getLength(line);
      let output;
      if (length > 100) {
        output = Math.round((length / 1000) * 100) / 100 + ' km';
      } else {
        output = Math.round(length * 100) / 100 + ' m';
      }
      return output;
    };

    const formatArea = (polygon) => {
      const area = getArea(polygon);
      let output;
      if (area > 10000) {
        output = Math.round((area / 1000000) * 100) / 100 + ' km<sup>2</sup>';
      } else {
        output = Math.round(area * 100) / 100 + ' m<sup>2</sup>';
      }
      return output;
    };

    let draw;

    const addInteraction = () => {
        const type = drawType === 'Polygon' ? 'Polygon' : 'LineString'; 
        draw = new Draw({
          source: source,
          type: type,
          style: function (feature) {
            const geometryType = feature.getGeometry().getType();
            if (geometryType === type || geometryType === 'Point') {
              return style;
            }
          },
        });
        map.addInteraction(draw);
      
        createMeasureTooltip();
        createHelpTooltip();
      
        let listener;
        draw.on('drawstart', function (evt) {
          // set sketch
          draw.sketchFeature = evt.feature;
      
          let tooltipCoord = evt.coordinate;
      
          listener = draw.sketchFeature.getGeometry().on('change', function (evt) {
            const geom = evt.target;
            let output;
            if (geom instanceof Polygon) {
              output = formatArea(geom);
              tooltipCoord = geom.getInteriorPoint().getCoordinates();
            } else if (geom instanceof LineString) {
              output = formatLength(geom);
              tooltipCoord = geom.getLastCoordinate();
            }
            measureTooltipRef.current.innerHTML = output;
            measureTooltipRef.current.style.display = 'block';
            measureTooltipRef.current.style.left = `${tooltipCoord[0]}px`;
            measureTooltipRef.current.style.top = `${tooltipCoord[1] - 15}px`;
          });
        });
      
        draw.on('drawend', function () {
          measureTooltipRef.current.className = 'ol-tooltip ol-tooltip-static';
          measureTooltipRef.current.style.offset = '0px -7px';
          // unset sketch
          draw.sketchFeature = null;
          // ensure tooltip remains visible
          measureTooltipRef.current.style.display = 'block';
          measureTooltipRef.current = null; // Set to null so that a new one can be created
          createMeasureTooltip();
          unByKey(listener);
        });
      };
      

    map.on('pointermove', pointerMoveHandler);

    map.getViewport().addEventListener('mouseout', () => {
      helpTooltipRef.current.classList.add('hidden');
    });

    addInteraction();

    return () => {
      map.setTarget(null);
    };
  }, [drawType]);

  return (
    <div>
      <select id="type" onChange={(e) => setDrawType(e.target.value)}>
        <option value="LineString">Line</option>
        <option value="Polygon">Area</option>
      </select>
      <div ref={mapRef} className="map" />
    </div>
  );
};

export default MapComponent;
