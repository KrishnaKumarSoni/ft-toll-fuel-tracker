import React, { useState, useEffect, useRef } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Select,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Grid,
  GridItem,
  Image,
  extendTheme,
  FormControl,
  FormLabel,
  FormHelperText,
  IconButton,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom theme
const theme = extendTheme({
  colors: {
    brand: {
      primary: '#ffcb36',
      black: '#000000',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'white',
        color: 'black',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 'md',
      },
      variants: {
        solid: {
          bg: '#ffcb36',
          color: 'black',
          _hover: {
            bg: '#e6b730',
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderRadius: 'md',
            borderColor: 'gray.300',
            _focus: {
              borderColor: '#ffcb36',
              boxShadow: '0 0 0 1px #ffcb36',
            },
          },
        },
      },
    },
    Select: {
      variants: {
        outline: {
          field: {
            borderRadius: 'md',
            borderColor: 'gray.300',
            _focus: {
              borderColor: '#ffcb36',
              boxShadow: '0 0 0 1px #ffcb36',
            },
          },
        },
      },
    },
    Tabs: {
      variants: {
        line: {
          tab: {
            color: 'gray.600',
            _selected: {
              color: 'black',
              borderColor: '#ffcb36',
            },
          },
        },
      },
    },
  },
});

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const tollBoothIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Map bounds adjuster component
function MapBoundsAdjuster({ coordinates, originCoord, destCoord }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates?.length > 0) {
      const allPoints = [...coordinates];
      if (originCoord) allPoints.push(originCoord);
      if (destCoord) allPoints.push(destCoord);
      
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, originCoord, destCoord, map]);

  return null;
}

// Custom Label component for toll prices
function TollLabel({ position, price }) {
  return (
    <div 
      style={{
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        zIndex: 1000,
      }}
    >
      ₹{price}
    </div>
  );
}

function App() {
  const [tollOrigin, setTollOrigin] = useState('');
  const [tollDestination, setTollDestination] = useState('');
  const [journeyType, setJourneyType] = useState('PV_SJ');
  const [fuelLocation, setFuelLocation] = useState('');
  const [fuelType, setFuelType] = useState('petrol');
  const [results, setResults] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [originCoord, setOriginCoord] = useState(null);
  const [destCoord, setDestCoord] = useState(null);
  const [waypoints, setWaypoints] = useState(['']);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();
  const toast = useToast();

  // Function to handle waypoint changes
  const handleWaypointChange = (index, value) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = value;
    setWaypoints(newWaypoints);
  };

  // Function to add new waypoint input
  const addWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  // Function to remove waypoint input
  const removeWaypoint = (index) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
  };

  const handleTollSearch = async (confirmed = false) => {
    if (!tollOrigin || !tollDestination) {
      toast({
        title: 'Error',
        description: 'Please enter both origin and destination',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Check if waypoints are empty and not confirmed
    const hasEmptyWaypoints = waypoints.some(wp => wp.trim() === '');
    if (hasEmptyWaypoints && !confirmed) {
      onOpen();
      return;
    }

    setIsLoading(true);
    try {
      // Filter out empty waypoints and join with |
      const waypointsString = waypoints
        .filter(wp => wp.trim() !== '')
        .join('|');

      const response = await axios.get('/api/proxy', {
        params: {
          endpoint: 'toll',
          origin: tollOrigin,
          destination: tollDestination,
          waypoints: waypointsString || undefined,
          journey_type: journeyType,
          include_route: true,
          include_route_metadata: true,
          include_booths: true,
          include_booths_locations: true
        }
      });
      
      const data = response.data;
      
      // Process toll booths if they exist
      if (data.toll_booths) {
        data.toll_booths = data.toll_booths.map(booth => {
          if (!booth.location && booth.latitude && booth.longitude) {
            booth.location = [booth.longitude, booth.latitude];
          }
          return booth;
        });
      }
      
      setResults(data);

      // Set origin and destination coordinates
      if (data.route?.length > 0) {
        setOriginCoord([data.route[0][1], data.route[0][0]]);
        setDestCoord([data.route[data.route.length - 1][1], data.route[data.route.length - 1][0]]);
      }

      // Prepare toll data to send back
      const tollData = {
        total_toll_price: data.total_toll_price || 0,
        toll_count: data.toll_count || 0,
        distance_km: data.route_metadata?.distance_km || 0,
        duration_min: data.route_metadata?.duration_min || 0,
        origin: tollOrigin,
        destination: tollDestination,
        waypoints: waypointsString,
        vehicle: journeyType,
        toll_booths: data.toll_booths?.map(booth => ({
          name: booth.name,
          price: booth.price
        })) || []
      };

      // Send data back to opener window if it exists
      if (window.opener) {
        // Using postMessage - this is the safe cross-origin method
        window.opener.postMessage({
          type: 'TOLL_DATA',
          data: tollData
        }, '*');

        // Show success message
        toast({
          title: 'Data Sent',
          description: 'Toll information has been sent back to the main window',
          status: 'success',
          duration: 3000,
        });
      }

    } catch (error) {
      console.error('API Error:', error);
      
      // Handle 402 Payment Required error
      if (error.response?.status === 402) {
        toast({
          title: 'Subscription Required',
          description: 'This feature requires a paid API subscription. Please contact support for more information.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error',
          description: error.response?.data?.message || error.message || 'An error occurred while fetching toll information',
          status: 'error',
          duration: 3000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFuelSearch = async () => {
    if (!fuelLocation) {
      toast({
        title: 'Error',
        description: 'Please enter a location',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      // Clear previous results
      setResults(null);
      setOriginCoord(null);
      setDestCoord(null);

      // First get the fuel prices
      const response = await axios.get('/api/proxy', {
        params: {
          endpoint: 'fuel/prices',
          query: fuelLocation,
          date: new Date().toISOString().split('T')[0],
          fuel_type: fuelType
        }
      });

      console.log('Fuel API Response:', response.data);

      // Process the fuel price data
      const data = response.data;
      const cityData = data[Object.keys(data)[0]]; // Get the first city's data
      
      if (!cityData) {
        throw new Error('No data found for this location');
      }

      const price = fuelType === 'petrol' ? cityData.petrol_price : cityData.diesel_price;
      
      if (!price) {
        throw new Error(`No ${fuelType} price data available for this location`);
      }

      // Use geocoding to get coordinates for the location
      try {
        const geocodeResponse = await axios.get('/api/proxy', {
          params: {
            endpoint: 'geocode',
            query: fuelLocation
          }
        });

        console.log('Geocode Response:', geocodeResponse.data);

        if (geocodeResponse.data?.latitude && geocodeResponse.data?.longitude) {
          const location = [geocodeResponse.data.latitude, geocodeResponse.data.longitude];
          setMapCenter(location);
          setMapZoom(13);
          
          // Create a modified results object that works with our existing map display
          setResults({
            fuel_data: {
              ...cityData,
              price: price,
              date: new Date().toISOString(),
              city: Object.keys(data)[0]
            },
            route: null,
            toll_count: null,
            total_toll_price: null,
            location: location
          });

          // Show fuel price in toast
          toast({
            title: 'Fuel Prices Found',
            description: `${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Price: ₹${price}`,
            status: 'success',
            duration: 5000,
          });
        } else {
          throw new Error('Location coordinates not found in response');
        }
      } catch (geocodeError) {
        console.error('Geocoding Error:', geocodeError);
        // If geocoding fails, we'll still show the fuel price but center the map on India
        setMapCenter([20.5937, 78.9629]);
        setMapZoom(5);
        
        setResults({
          fuel_data: {
            ...cityData,
            price: price,
            date: new Date().toISOString(),
            city: Object.keys(data)[0]
          },
          route: null,
          toll_count: null,
          total_toll_price: null,
          location: null
        });

        // Show fuel price in toast without the warning about map location
        toast({
          title: 'Fuel Prices Found',
          description: `${fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Price: ₹${price}`,
          status: 'success',
          duration: 5000,
        });
      }

    } catch (error) {
      console.error('Fuel API Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch fuel prices',
        status: 'error',
        duration: 3000,
      });
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Add URL parameter handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Get values from URL parameters
    const origin = params.get('origin');
    const destination = params.get('destination');
    const waypoints = params.get('waypoints');
    const vehicle = params.get('vehicle');
    const format = params.get('format');
    
    // Set form values if URL parameters exist
    if (origin) setTollOrigin(decodeURIComponent(origin));
    if (destination) setTollDestination(decodeURIComponent(destination));
    if (waypoints) setWaypoints(decodeURIComponent(waypoints));
    if (vehicle) setJourneyType(decodeURIComponent(vehicle));
    
    // If format=json, we'll return just the toll data
    if (format === 'json') {
      // ... existing json format code ...
    }
    
    // Regular UI flow - use a longer delay and check if values are set
    if (origin && destination) {
      const timer = setTimeout(() => {
        // Double check if values are actually set in state
        if (tollOrigin && tollDestination) {
          handleTollSearch();
        }
      }, 1000); // Increased from 100ms to 1000ms
      
      return () => clearTimeout(timer); // Cleanup timeout
    }
  }, [tollOrigin, tollDestination]); // Add dependencies to re-run when these values change

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg="white">
        {/* Navigation Bar */}
        <Box 
          h="60px" 
          bg="white" 
          px={6}
          position="relative"
          borderBottom="1px solid"
          borderColor="gray.100"
          boxShadow="0 2px 4px rgba(0,0,0,0.05)"
        >
          <HStack h="100%" spacing={4}>
            <Image src="/logoFT.png" h="40px" />
            <Text fontSize="xl" fontWeight="bold" color="black">
              FT Toll & Fuel Tracker
            </Text>
          </HStack>
        </Box>

        {/* Main Content - adjust top padding to account for nav bar shadow */}
        <Grid templateColumns="1fr 400px" gap={4} h="calc(100vh - 60px)" p={6}>
          {/* Left side - Map */}
          <GridItem position="relative" overflow="hidden" borderRadius="lg" boxShadow="base">
            {/* Summary overlay */}
            {results && (
              <Box
                position="absolute"
                top={4}
                right={4}
                bg="white"
                p={4}
                zIndex={1000}
                borderRadius="lg"
                boxShadow="md"
                border="1px solid"
                borderColor="gray.200"
              >
                {results.toll_count !== null ? (
                  <>
                    <Text fontWeight="bold">Total Toll Booths: {results.toll_count || 0}</Text>
                    <Text fontWeight="bold">Total Price: ₹{results.total_toll_price || 0}</Text>
                  </>
                ) : results.fuel_data && (
                  <>
                    <Text fontWeight="bold">Location: {fuelLocation}</Text>
                    <Text fontWeight="bold">
                      {fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Price: ₹{results.fuel_data.price || 'N/A'}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Last Updated: {new Date(results.fuel_data.date || Date.now()).toLocaleDateString()}
                    </Text>
                  </>
                )}
              </Box>
            )}

            <Box h="85%" w="85%" mx="auto" my={8} borderRadius="lg" overflow="hidden">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Show route for toll search */}
                {results?.route && Array.isArray(results.route) && (
                  <>
                    <Polyline
                      positions={results.route
                        .filter(coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
                        .map(coord => [coord[1], coord[0]])}
                      color="blue"
                      weight={3}
                    />
                    <MapBoundsAdjuster 
                      coordinates={results.route.map(coord => [coord[1], coord[0]])}
                      originCoord={originCoord}
                      destCoord={destCoord}
                    />
                  </>
                )}

                {/* Show marker for fuel location */}
                {results?.location && !results.route && (
                  <Marker 
                    position={results.location}
                    icon={originIcon}
                  >
                    <Popup>
                      <div>
                        <strong>{fuelLocation}</strong><br />
                        {fuelType.charAt(0).toUpperCase() + fuelType.slice(1)} Price: ₹{results.fuel_data.price || 'N/A'}<br />
                        Last Updated: {new Date(results.fuel_data.date || Date.now()).toLocaleDateString()}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Rest of the markers remain same */}
                {originCoord && results?.route && (
                  <Marker position={originCoord} icon={originIcon}>
                    <Popup>Origin: {tollOrigin}</Popup>
                  </Marker>
                )}

                {destCoord && results?.route && (
                  <Marker position={destCoord} icon={destinationIcon}>
                    <Popup>Destination: {tollDestination}</Popup>
                  </Marker>
                )}

                {results?.toll_booths?.map((booth, index) => {
                  let location = null;
                  if (booth?.location && Array.isArray(booth.location) && booth.location.length >= 2) {
                    location = [booth.location[1], booth.location[0]];
                  } else if (booth?.latitude && booth?.longitude) {
                    location = [booth.latitude, booth.longitude];
                  }

                  return location && (
                    <Marker
                      key={index}
                      position={location}
                      icon={tollBoothIcon}
                    >
                      <Popup>
                        <div>
                          <strong>Toll Booth {index + 1}</strong><br />
                          Price: ₹{booth.price || 'N/A'}<br />
                          {booth.name && <span>Name: {booth.name}<br /></span>}
                        </div>
                      </Popup>
                      <div style={{
                        position: 'absolute',
                        top: '-25px',
                        left: '15px',
                        backgroundColor: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        ₹{booth.price || 0}
                      </div>
                    </Marker>
                  );
                })}
              </MapContainer>
            </Box>

            {/* Loading overlay */}
            {isLoading && (
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="whiteAlpha.800"
                zIndex="1000"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Spinner size="xl" color="#ffcb36" />
              </Box>
            )}
          </GridItem>

          {/* Right side - Options */}
          <GridItem bg="white" p={6} borderRadius="lg" boxShadow="base" border="1px solid" borderColor="gray.200">
            <VStack spacing={6} align="stretch">
              <Tabs variant="line" colorScheme="brand">
                <TabList borderBottomColor="gray.200">
                  <Tab>Toll</Tab>
                  <Tab>Fuel</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Input
                        placeholder="Origin"
                        value={tollOrigin}
                        onChange={(e) => setTollOrigin(e.target.value)}
                        isDisabled={isLoading}
                      />
                      <Input
                        placeholder="Destination"
                        value={tollDestination}
                        onChange={(e) => setTollDestination(e.target.value)}
                        isDisabled={isLoading}
                      />
                      
                      {/* Waypoints section */}
                      <FormControl>
                        <FormLabel>Waypoints</FormLabel>
                        {waypoints.map((waypoint, index) => (
                          <HStack key={index} mt={2}>
                            <Input
                              placeholder={`Waypoint ${index + 1}`}
                              value={waypoint}
                              onChange={(e) => handleWaypointChange(index, e.target.value)}
                              isDisabled={isLoading}
                            />
                            {waypoints.length > 1 && (
                              <IconButton
                                icon={<Text>-</Text>}
                                onClick={() => removeWaypoint(index)}
                                isDisabled={isLoading}
                                colorScheme="red"
                                variant="outline"
                              />
                            )}
                            {index === waypoints.length - 1 && (
                              <IconButton
                                icon={<Text>+</Text>}
                                onClick={addWaypoint}
                                isDisabled={isLoading}
                                colorScheme="green"
                                variant="outline"
                              />
                            )}
                          </HStack>
                        ))}
                      </FormControl>

                      <Select
                        value={journeyType}
                        onChange={(e) => setJourneyType(e.target.value)}
                        isDisabled={isLoading}
                      >
                        <option value="2W_SJ">Two Wheeler - Single Journey</option>
                        <option value="2W_RJ">Two Wheeler - Return Journey</option>
                        <option value="2W_MP">Two Wheeler - Monthly Pass</option>
                        <option value="PV_SJ">Personal Vehicle - Single Journey</option>
                        <option value="PV_RJ">Personal Vehicle - Return Journey</option>
                        <option value="PV_MP">Personal Vehicle - Monthly Pass</option>
                        <option value="LCV_SJ">Light Commercial Vehicle - Single Journey</option>
                        <option value="LCV_RJ">Light Commercial Vehicle - Return Journey</option>
                        <option value="LCV_MP">Light Commercial Vehicle - Monthly Journey</option>
                        <option value="BUS_SJ">Bus/Truck - Single Journey</option>
                        <option value="BUS_RJ">Bus/Truck - Return Journey</option>
                        <option value="BUS_MP">Bus/Truck - Monthly Journey</option>
                        <option value="3AX_SJ">Up to 3 Axle Vehicle - Single Journey</option>
                        <option value="3AX_RJ">Up to 3 Axle Vehicle - Return Journey</option>
                        <option value="3AX_MP">Up to 3 Axle Vehicle - Monthly Journey</option>
                        <option value="4TO6AX_SJ">4 to 6 Axle Vehicle - Single Journey</option>
                        <option value="4TO6AX_RJ">4 to 6 Axle Vehicle - Return Journey</option>
                        <option value="4TO6AX_MP">4 to 6 Axle Vehicle - Monthly Journey</option>
                        <option value="HCM_EME_SJ">HCM/EME Vehicle - Single Journey</option>
                        <option value="HCM_EME_RJ">HCM/EME Vehicle - Return Journey</option>
                        <option value="HCM_EME_MP">HCM/EME Vehicle - Monthly Journey</option>
                        <option value="7AX_SJ">7 or More Axle Vehicle - Single Journey</option>
                        <option value="7AX_RJ">7 or More Axle Vehicle - Return Journey</option>
                        <option value="7AX_MP">7 or More Axle Vehicle - Monthly Journey</option>
                      </Select>
                      <Button
                        onClick={() => handleTollSearch()}
                        isLoading={isLoading}
                        loadingText="Searching..."
                      >
                        Search Toll
                      </Button>
                    </VStack>
                  </TabPanel>

                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Input
                        placeholder="Location"
                        value={fuelLocation}
                        onChange={(e) => setFuelLocation(e.target.value)}
                        isDisabled={isLoading}
                      />
                      <Select
                        value={fuelType}
                        onChange={(e) => setFuelType(e.target.value)}
                        isDisabled={isLoading}
                      >
                        <option value="petrol">Petrol</option>
                        <option value="diesel">Diesel</option>
                      </Select>
                      <Button
                        onClick={handleFuelSearch}
                        isLoading={isLoading}
                        loadingText="Searching..."
                      >
                        Search Fuel Prices
                      </Button>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </VStack>
          </GridItem>
        </Grid>

        {/* Add the confirmation dialog */}
        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={cancelRef}
          onClose={onClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Empty Waypoints
              </AlertDialogHeader>

              <AlertDialogBody>
                You haven't entered all waypoints. Are you sure you want to continue without them?
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  colorScheme="yellow"
                  onClick={() => {
                    onClose();
                    handleTollSearch(true);
                  }}
                  ml={3}
                >
                  Continue
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Box>
    </ChakraProvider>
  );
}

export default App; 