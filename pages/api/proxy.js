import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = '9c28d2905ccce4a47416a00db2a28d2930dc44564e48f5823b54c0809b8ce7b7';
  const { endpoint, ...params } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint parameter is required' });
  }

  try {
    // Remove endpoint from params as it's part of the URL
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== 'undefined') {
        queryString.append(key, value);
      }
    }

    const url = `https://api.leptonmaps.com/v1/${endpoint}${queryString.toString() ? '?' + queryString.toString() : ''}`;
    console.log('Requesting URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', responseText);
      return res.status(500).json({
        error: 'Invalid JSON response from API',
        details: responseText
      });
    }

    if (!response.ok) {
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
      
      if (response.status === 402) {
        return res.status(402).json({
          error: 'API subscription required',
          message: 'The API key requires a paid subscription or has exceeded its quota.',
          details: data
        });
      }
      
      return res.status(response.status).json({
        error: `API request failed with status ${response.status}`,
        message: response.statusText,
        details: data
      });
    }

    console.log('API Success Response:', {
      url,
      params,
      response: data
    });

    // Validate toll data for toll endpoint
    if (endpoint === 'toll' && (data.total_toll_price === undefined || data.total_toll_price === null)) {
      console.error('Invalid toll data received:', data);
      return res.status(400).json({
        error: 'Invalid toll data',
        message: 'The API response did not contain expected toll information',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', {
      error: error.message,
      stack: error.stack,
      params
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 