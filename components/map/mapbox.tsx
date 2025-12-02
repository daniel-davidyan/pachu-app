'use client';

import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return; // initialize map only once
    
    mapboxgl.accessToken = accessToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialViewState.longitude, initialViewState.latitude],
      zoom: initialViewState.zoom
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [accessToken, initialViewState]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

