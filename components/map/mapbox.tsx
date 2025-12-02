'use client';

import { useRef, useEffect, useState } from 'react';
import Map, { MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapboxProps {
  accessToken: string;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
}

export function Mapbox({ 
  accessToken,
  initialViewState = {
    longitude: -122.4,
    latitude: 37.8,
    zoom: 12
  }
}: MapboxProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(initialViewState);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={accessToken}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

