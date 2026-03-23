// src/frontend/components/Map.jsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker colors based on permit type
const getMarkerIcon = (permitType) => {
  const colors = {
    'Residential': '#3b82f6', // blue
    'Commercial': '#f59e0b', // orange
    'Mixed Use': '#8b5cf6',  // purple
  };

  const color = colors[permitType] || '#6b7280'; // default gray

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 25px;
        height: 25px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        <div style="
          transform: rotate(45deg);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: bold;
        ">
          ${permitType === 'Residential' ? 'R' : permitType === 'Commercial' ? 'C' : '•'}
        </div>
      </div>
    `,
    iconSize: [25, 25],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
};

function Map({ permits }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      // Initialize map centered on Portland
      mapInstanceRef.current = L.map(mapRef.current).setView([45.5152, -122.6784], 12);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstanceRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Track permits with and without coordinates
    let withCoords = 0;
    let withoutCoords = 0;

    // Add markers for permits - ONLY if they have coordinates
    permits.forEach(permit => {
      if (permit.latitude && permit.longitude) {
        withCoords++;
        
        // Build the popup content
        const popupContent = buildPopupContent(permit);

        const marker = L.marker(
          [permit.latitude, permit.longitude],
          { icon: getMarkerIcon(permit.addr_type || permit.type_of_use) }
        )
          .bindPopup(popupContent, {
            maxWidth: 350,
            className: 'permit-popup'
          })
          .addTo(mapInstanceRef.current);
        
        markersRef.current.push(marker);
      } else {
        withoutCoords++;
      }
    });

    console.log(`Map: Showing ${withCoords} permits with coordinates, ${withoutCoords} without coordinates`);

    // Fit bounds if there are permits with coordinates
    if (withCoords > 0) {
      const bounds = L.latLngBounds(
        permits
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.latitude, p.longitude])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [permits]);

  return (
    <>
      <div ref={mapRef} style={{ flex: 1, height: '100%' }} />
      <style>{`
        .permit-popup .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .permit-popup .leaflet-popup-content {
          margin: 0;
          padding: 0;
        }
        .custom-marker {
          background: transparent;
          border: none;
        }
      `}</style>
    </>
  );
}

/**
 * Build formatted popup content for a permit
 */
function buildPopupContent(permit) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  // Determine status color
  const statusColors = {
    'Active': '#10b981',
    'Retired': '#ef4444',
    'NEW': '#3b82f6',
    'CONFIRMED': '#8b5cf6',
    'CHANGED': '#f59e0b',
    'REMOVED': '#6b7280',
    'Under Review': '#f59e0b',
    'Issued': '#10b981',
    'Final': '#8b5cf6',
    'Under Inspection': '#3b82f6'
  };
  const statusColor = statusColors[permit.status] || '#6b7280';

  // Build the HTML
  return `
    <div style="padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <!-- Header -->
      <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
          ${escapeHtml(permit.address || permit.location || 'Unknown Address')}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="
            background-color: ${statusColor}20;
            color: ${statusColor};
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          ">
            ${escapeHtml(permit.status || 'Unknown')}
          </span>
          ${permit.addr_type || permit.type_of_use ? `
            <span style="
              background-color: #f3f4f6;
              color: #4b5563;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
            ">
              ${escapeHtml(permit.addr_type || permit.type_of_use)}
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Description of Work / Comment Section - Highlighted -->
      ${permit.description_of_work || permit.comment ? `
        <div style="
          background-color: #fef3c7;
          border-left: 3px solid #f59e0b;
          padding: 10px;
          margin-bottom: 12px;
          border-radius: 4px;
        ">
          <div style="font-size: 11px; font-weight: 600; color: #92400e; margin-bottom: 4px; text-transform: uppercase;">
            ${permit.description_of_work ? 'Description of Work' : 'Comment'}
          </div>
          <div style="font-size: 13px; color: #78350f; line-height: 1.4;">
            ${escapeHtml(permit.description_of_work || permit.comment)}
          </div>
        </div>
      ` : ''}

      <!-- Details Grid -->
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; font-size: 13px;">
        ${permit.case_number ? `
          <div style="color: #6b7280; font-weight: 500;">Case Number:</div>
          <div style="color: #1f2937; font-family: monospace; font-size: 12px;">${escapeHtml(permit.case_number)}</div>
        ` : ''}
        
        ${permit.work_proposed ? `
          <div style="color: #6b7280; font-weight: 500;">Work Type:</div>
          <div style="color: #1f2937;">${escapeHtml(permit.work_proposed)}</div>
        ` : ''}
        
        ${permit.type_of_use ? `
          <div style="color: #6b7280; font-weight: 500;">Use Type:</div>
          <div style="color: #1f2937;">${escapeHtml(permit.type_of_use)}</div>
        ` : ''}
        
        ${permit.valuation ? `
          <div style="color: #6b7280; font-weight: 500;">Valuation:</div>
          <div style="color: #16a34a; font-weight: 600;">$${permit.valuation.toLocaleString()}</div>
        ` : ''}
        
        ${permit.date_received ? `
          <div style="color: #6b7280; font-weight: 500;">Date Received:</div>
          <div style="color: #1f2937;">${formatDate(permit.date_received)}</div>
        ` : ''}
        
        ${permit.date_issued ? `
          <div style="color: #6b7280; font-weight: 500;">Date Issued:</div>
          <div style="color: #1f2937;">${formatDate(permit.date_issued)}</div>
        ` : ''}
        
        ${permit.change_date ? `
          <div style="color: #6b7280; font-weight: 500;">Changed:</div>
          <div style="color: #1f2937;">${formatDate(permit.change_date)}</div>
        ` : ''}
        
        ${permit.create_date ? `
          <div style="color: #6b7280; font-weight: 500;">Created:</div>
          <div style="color: #1f2937;">${formatDate(permit.create_date)}</div>
        ` : ''}
        
        ${permit.retired_date ? `
          <div style="color: #6b7280; font-weight: 500;">Retired:</div>
          <div style="color: #ef4444;">${formatDate(permit.retired_date)}</div>
        ` : ''}

        ${permit.contractor ? `
          <div style="color: #6b7280; font-weight: 500;">Contractor:</div>
          <div style="color: #1f2937; font-size: 12px;">${escapeHtml(permit.contractor.split('\n')[0])}</div>
        ` : ''}

        ${permit.unit ? `
          <div style="color: #6b7280; font-weight: 500;">Unit:</div>
          <div style="color: #1f2937;">${escapeHtml(permit.unit_type || '')} ${escapeHtml(permit.unit)}</div>
        ` : ''}

        ${permit.r_no ? `
          <div style="color: #6b7280; font-weight: 500;">R Number:</div>
          <div style="color: #1f2937; font-family: monospace; font-size: 12px;">${escapeHtml(permit.r_no)}</div>
        ` : ''}

        ${permit.address_id ? `
          <div style="color: #6b7280; font-weight: 500;">Address ID:</div>
          <div style="color: #1f2937; font-family: monospace; font-size: 12px;">${permit.address_id}</div>
        ` : ''}
        
        ${permit.ivr_number ? `
          <div style="color: #6b7280; font-weight: 500;">IVR Number:</div>
          <div style="color: #1f2937; font-family: monospace; font-size: 12px;">${escapeHtml(permit.ivr_number)}</div>
        ` : ''}
      </div>

      <!-- Permit Details Link -->
      ${permit.permit_details_url ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <a href="${escapeHtml(permit.permit_details_url)}" target="_blank" style="
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 12px;
            font-weight: 600;
          ">
            View Full Permit Details →
          </a>
        </div>
      ` : ''}

      <!-- Legal Description (if available) -->
      ${permit.legal_description || permit.property_legal_description ? `
        <div style="
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #6b7280;
        ">
          <div style="font-weight: 600; margin-bottom: 4px;">Legal Description:</div>
          <div style="line-height: 1.3;">
            ${escapeHtml(permit.legal_description || permit.property_legal_description)}
          </div>
        </div>
      ` : ''}

      <!-- Coordinates -->
      <div style="
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        font-size: 11px;
        color: #9ca3af;
        text-align: center;
      ">
        ${permit.latitude.toFixed(5)}, ${permit.longitude.toFixed(5)}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default Map;