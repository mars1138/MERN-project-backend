const axios = require('axios');

const HttpError = require('../models/http-error');

const API_KEY = '';

async function getCoordsForAddress(address) {
  // Dummy function to use if API not working:
  //   return {
  //     lat: 40.7484474,
  //     lng: -73.9871516,
  //   };

  // geocode API by arcgis.com
  const response = await axios.get(
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
    {
      params: {
        f: 'json',
        singleLine: address,
        outFields: 'Match_addr,Addr_type',
      },
    }
  );

  //   const response = await axios.get(
  //     `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
  //       address
  //     )}&key=${API_KEY}`
  //   );

  const data = response.data;
  console.log('data', data);

  if (!data || data.status === 'ZERO_RESULTS') {
    const error = new HttpError(
      'Could not find location for the specified address.',
      422
    );
    throw error;
  }

  //   const coordinates = data.results[0].geometry.location;
  //   return coordinates;

  // Get Latitude
  const lat = response.data.candidates[0].location.y;
  // Get Longitude
  const lng = response.data.candidates[0].location.x;

  return {
    lat,
    lng,
  };
}

module.exports = getCoordsForAddress;
