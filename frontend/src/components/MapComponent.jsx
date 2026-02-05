import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MapComponent = ({
  center = [12.9716, 77.5946], // Default to Bangalore coordinates
  zoom = 13,
  markers = [],
  routes = [],
  onLocationSelect = null,
  className = "h-96 w-full"
}) => {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const routesRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    leafletMapRef.current = L.map(mapRef.current).setView(center, zoom);

    // Add OpenStreetMap tiles (free, open source)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    // Add click handler for location selection
    if (onLocationSelect) {
      leafletMapRef.current.on('click', (e) => {
        onLocationSelect([e.latlng.lat, e.latlng.lng]);
      });
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }
    };
  }, [center, zoom, onLocationSelect]);

  // Update markers
  useEffect(() => {
    if (!leafletMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      leafletMapRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add new markers
    markers.forEach(marker => {
      const markerOptions = {
        title: marker.title || '',
        ...marker.options
      };

      const leafletMarker = L.marker(marker.position, markerOptions)
        .addTo(leafletMapRef.current);

      if (marker.popup) {
        leafletMarker.bindPopup(marker.popup);
      }

      markersRef.current.push(leafletMarker);
    });
  }, [markers]);

  // Update routes
  useEffect(() => {
    if (!leafletMapRef.current) return;

    // Clear existing routes
    routesRef.current.forEach(route => {
      leafletMapRef.current.removeLayer(route);
    });
    routesRef.current = [];

    // Add new routes
    routes.forEach(route => {
      const polyline = L.polyline(route.positions, {
        color: route.color || 'blue',
        weight: route.weight || 3,
        opacity: route.opacity || 0.7,
        ...route.options
      }).addTo(leafletMapRef.current);

      routesRef.current.push(polyline);
    });
  }, [routes]);

  // Update map center and zoom when props change
  useEffect(() => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.setView(center, zoom);
  }, [center, zoom]);

  return <div ref={mapRef} className={className} />;
};

export default MapComponent;