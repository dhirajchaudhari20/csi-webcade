import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  IconButton,
  Input,
  SkeletonText,
  Text,
  VStack,
  Collapse,
  InputGroup,
  InputLeftElement,
  useToast,
} from "@chakra-ui/react";
import {
  FaLocationArrow,
  FaTimes,
  FaAmbulance,
  FaSearch,
  FaHospital,
} from "react-icons/fa";
import {
  useJsApiLoader,
  GoogleMap,
  DirectionsRenderer,
  Autocomplete,
} from "@react-google-maps/api";
import { useRef, useState, useEffect } from "react";
import axios from "axios";
import TrafficInfo from "../traffic-info-commponent/TrafficInfo"; // Since TrafficInfo.js is in the same directory as App.js

const center = { lat: 20.5937, lng: 78.9629 }; // Default to India

function App() {
  const toast = useToast();
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  // State hooks
  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [weather, setWeather] = useState("");
  const [hospitals, setHospitals] = useState([]);
  const [filteredHospitals, setFilteredHospitals] = useState([]);
  const [showHospitalList, setShowHospitalList] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [originLocation, setOriginLocation] = useState({
    lat: null,
    lng: null,
    address: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentLocationMarker, setCurrentLocationMarker] = useState(null);
  const [currentPosition, setCurrentPosition] = useState({
    lat: null,
    lng: null,
  });

  const originRef = useRef(null);
  const destinationRef = useRef(null);

  // Geocoding function
  const geocodeLatLng = async (lat, lng) => {
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results[0]) {
          resolve(results[0].formatted_address); // Full address returned here
        } else {
          reject(
            new Error(
              "Geocode was not successful for the following reason: " + status
            )
          );
        }
      });
    });
  };

  useEffect(() => {
    return () => {}; // Clean up any intervals or effects related to vehicle simulation if needed
  }, []);

  if (!isLoaded) {
    return <SkeletonText height="100vh" width="100%" />;
  }

  const fetchWeather = async (lat, lng) => {
    const apiKey = "f1cff0df6f777e52f188f38e254afe63"; // Replace with your API key
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`
      );
      return response.data.weather[0].description;
    } catch (error) {
      console.error("Weather API Error:", error);
      toast({
        title: "Weather Data Error",
        description: "Unable to fetch weather data.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return "Unable to fetch weather data";
    }
  };
  const findHospitalsNearby = async (lat, lng) => {
    if (!map) return;

    const placesService = new window.google.maps.places.PlacesService(map);
    const request = {
      location: new window.google.maps.LatLng(lat, lng),
      radius: 5000, // 5 km radius
      type: "hospital",
      region: "IN", // Restrict search to India
    };

    placesService.nearbySearch(request, (results, status) => {
      if (
        status === window.google.maps.places.PlacesServiceStatus.OK &&
        results
      ) {
        const hospitalsWithDetails = results.map((hospital) => {
          return new Promise((resolve) => {
            placesService.getDetails(
              { placeId: hospital.place_id },
              (place, status) => {
                if (
                  status === window.google.maps.places.PlacesServiceStatus.OK &&
                  place
                ) {
                  resolve({
                    ...hospital,
                    phoneNumber: place.formatted_phone_number || "N/A",
                    openingHours: place.opening_hours || null, // Check if opening hours data is available
                  });
                } else {
                  resolve({
                    ...hospital,
                    phoneNumber: "N/A",
                    openingHours: null,
                  });
                }
              }
            );
          });
        });

        Promise.all(hospitalsWithDetails).then((hospitals) => {
          setHospitals(hospitals);
          setFilteredHospitals(hospitals);
          setShowHospitalList(hospitals.length > 0);
        });
      } else {
        console.error("Failed to fetch nearby hospitals");
        setHospitals([]);
        setFilteredHospitals([]);
        setShowHospitalList(false);
      }
    });
  };

  const handleAutocompleteChange = (place) => {
    if (place) {
      const { geometry } = place;
      if (geometry && geometry.location) {
        const lat = geometry.location.lat();
        const lng = geometry.location.lng();
        geocodeLatLng(lat, lng).then((address) => {
          if (place === originRef.current.getPlace()) {
            setOriginLocation({ lat, lng, address });
            if (originRef.current) {
              originRef.current.value = address; // Ensure the address is set in the input
            }
          }
        });
      }
    }
  };

  // Function to calculate route with live traffic and show traffic conditions
  async function calculateRoute() {
    if (originRef.current.value === "" || destinationRef.current.value === "") {
      toast({
        title: "Input Error",
        description: "Please provide both origin and destination.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    try {
      const results = await directionsService.route({
        origin: originRef.current.value,
        destination: destinationRef.current.value,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(), // Real-time traffic is considered here
        },
      });

      const leg = results.routes[0].legs[0];
      const weather = await fetchWeather(
        leg.end_location.lat(),
        leg.end_location.lng()
      );

      setDirectionsResponse(results);
      setDistance(leg.distance.text);
      setDuration(leg.duration.text);
      setWeather(weather);

      findHospitalsNearby(leg.end_location.lat(), leg.end_location.lng());
    } catch (error) {
      console.error("Failed to calculate route:", error);
      toast({
        title: "Route Calculation Error",
        description: "Unable to calculate route.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setDirectionsResponse(null);
    }
  }

  // Function to enable Traffic Layer on the map
  function enableTrafficLayer(map) {
    const trafficLayer = new window.google.maps.TrafficLayer();
    trafficLayer.setMap(map);
  }

  function startRoute() {
    if (directionsResponse) {
      const startLocation = directionsResponse.routes[0].legs[0].start_location;
      map.panTo(startLocation);
      map.setZoom(15);
      trackUserLocation(); // Start tracking user location
      toast({
        title: "Route Started",
        description: "Ambulance route has started!",
        status: "info",
        duration: 5000,
        isClosable: true,
      });
    } else {
      toast({
        title: "Route Not Calculated",
        description: "Please calculate a route first.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  }

  function clearRoute() {
    setDirectionsResponse(null);
    setDistance("");
    setDuration("");
    setWeather("");
    setHospitals([]);
    setFilteredHospitals([]);
    setShowHospitalList(false);
    setShowMore(false);
    originRef.current.value = "";
    destinationRef.current.value = "";
    if (currentLocationMarker) {
      currentLocationMarker.setMap(null); // Remove marker from map
      setCurrentLocationMarker(null);
    }
  }

  const useMyLocation = async () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await geocodeLatLng(latitude, longitude);
        if (originRef.current) {
          originRef.current.value = address;
          setOriginLocation({
            lat: latitude,
            lng: longitude,
            address: address,
          });
        }
        map.panTo({ lat: latitude, lng: longitude });
        map.setZoom(15);
      },
      (error) => {
        console.error("Geolocation Error:", error);
        toast({
          title: "Geolocation Error",
          description: "Unable to access your location.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    );
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleShowMore = () => {
    setShowMore(!showMore);
  };

  const setRouteToHospital = (hospital) => {
    if (map && destinationRef.current) {
      destinationRef.current.value = hospital.name;
      calculateRoute();
    }
  };

  const locateHospitalsNearMe = async () => {
    if (!originLocation.lat || !originLocation.lng) {
      toast({
        title: "Location Error",
        description: "Please set your origin location first.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const placesService = new window.google.maps.places.PlacesService(map);
    const request = {
      location: new window.google.maps.LatLng(
        originLocation.lat,
        originLocation.lng
      ),
      radius: 5000, // 5 km radius
      type: "hospital",
      region: "IN",
    };

    placesService.nearbySearch(request, (results, status) => {
      if (
        status === window.google.maps.places.PlacesServiceStatus.OK &&
        results
      ) {
        setHospitals(results);
        setFilteredHospitals(results);
        setShowHospitalList(results.length > 0);

        results.forEach((hospital) => {
          const directionsService = new window.google.maps.DirectionsService();
          directionsService.route(
            {
              origin: { lat: originLocation.lat, lng: originLocation.lng },
              destination: hospital.geometry.location,
              travelMode: window.google.maps.TravelMode.DRIVING,
              unitSystem: window.google.maps.UnitSystem.METRIC,
              provideRouteAlternatives: true,
            },
            (response, status) => {
              if (status === window.google.maps.DirectionsStatus.OK) {
                const directionsRenderer =
                  new window.google.maps.DirectionsRenderer({
                    map: map,
                    directions: response,
                    polylineOptions: {
                      strokeColor: "#FF0000",
                      strokeWeight: 5,
                    },
                  });
                directionsRenderer.setDirections(response);
              }
            }
          );
        });
      } else {
        console.error("Failed to fetch nearby hospitals");
        setHospitals([]);
        setFilteredHospitals([]);
        setShowHospitalList(false);
      }
    });
  };

  const updateCurrentLocationMarker = (lat, lng) => {
    if (currentLocationMarker) {
      currentLocationMarker.setPosition({ lat, lng });
    } else {
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        title: "You are here",
      });
      setCurrentLocationMarker(marker);
    }
  };

  const trackUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentPosition({ lat: latitude, lng: longitude });
          updateCurrentLocationMarker(latitude, longitude);
          map.panTo({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Geolocation Error",
            description: "Unable to access your location.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 5000,
        }
      );
    } else {
      toast({
        title: "Geolocation Error",
        description: "Geolocation is not supported by this browser.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Flex direction="column" h="100vh" w="100vw" position="relative">
      <Box h="100%" w="100%" position="relative" minH="500px">
        <GoogleMap
          center={center}
          zoom={10}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
          onLoad={(map) => {
            setMap(map);
            enableTrafficLayer(map); // Enable traffic layer when the map is loaded
          }}
        >
          {directionsResponse && (
            <DirectionsRenderer directions={directionsResponse} />
          )}
          <TrafficInfo /> {/* Add the TrafficInfo component here */}
        </GoogleMap>

        <Box
          position="absolute"
          top={4}
          left={4}
          right={4}
          p={4}
          bg="white"
          shadow="md"
          zIndex={1}
        >
          <HStack spacing={3} mb={4} alignItems="center">
            <Box flexGrow={1}>
              <Autocomplete
                onPlaceChanged={() =>
                  handleAutocompleteChange(originRef.current.getPlace())
                }
                options={{ componentRestrictions: { country: "IN" } }}
              >
                <Input
                  type="text"
                  placeholder="Origin (e.g. Delhi)"
                  ref={originRef}
                  borderColor="teal.300"
                  _hover={{ borderColor: "teal.500" }}
                  _focus={{ borderColor: "teal.500" }}
                />
              </Autocomplete>
            </Box>
            <Box flexGrow={1}>
              <Autocomplete
                onPlaceChanged={() =>
                  handleAutocompleteChange(destinationRef.current.getPlace())
                }
                options={{ componentRestrictions: { country: "IN" } }}
              >
                <Input
                  type="text"
                  placeholder="Destination (e.g. Mumbai)"
                  ref={destinationRef}
                  borderColor="teal.300"
                  _hover={{ borderColor: "teal.500" }}
                  _focus={{ borderColor: "teal.500" }}
                />
              </Autocomplete>
            </Box>
            <Button colorScheme="teal" onClick={calculateRoute}>
              Calculate Route
            </Button>
            <Button
              aria-label="Refresh Page"
              colorScheme="blue"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <IconButton
              aria-label="Clear route"
              icon={<FaTimes />}
              colorScheme="red"
              onClick={clearRoute}
            />
          </HStack>
          <HStack spacing={3} mb={4} alignItems="center">
            <Text fontSize="lg" fontWeight="semibold">
              Nearby Hospitals ({filteredHospitals.length})
            </Text>
            <Button
              colorScheme="teal"
              size="sm"
              onClick={() => setShowHospitalList(!showHospitalList)}
            >
              {showHospitalList ? "Close Menu" : "Show Hospitals"}
            </Button>
          </HStack>
          <Collapse in={showHospitalList}>
            <InputGroup mb={4}>
              <InputLeftElement pointerEvents="none">
                <FaSearch color="gray.300" />
              </InputLeftElement>
              <Input
                placeholder="Search Hospitals"
                value={searchTerm}
                onChange={handleSearchChange}
                borderColor="teal.300"
                _hover={{ borderColor: "teal.500" }}
                _focus={{ borderColor: "teal.500" }}
              />
            </InputGroup>
            <Box p={4} bg="white" shadow="md" maxH="300px" overflowY="auto">
              <VStack spacing={3} align="start">
                {filteredHospitals
                  .slice(0, showMore ? filteredHospitals.length : 5)
                  .map((hospital) => (
                    <Flex key={hospital.place_id} direction="column" mb={2}>
                      <Text fontWeight="bold">{hospital.name}</Text>
                      <Text fontSize="sm">{hospital.vicinity}</Text>
                      <Text fontSize="sm">Phone: {hospital.phoneNumber}</Text>
                      {hospital.openingHours ? (
                        <Text
                          fontSize="sm"
                          color={hospital.openingHours.isOpen ? "green" : "red"}
                        >
                          {hospital.openingHours.isOpen ? "Open Now" : "Closed"}
                        </Text>
                      ) : (
                        <Text fontSize="sm" color="gray">
                          Opening hours not available
                        </Text>
                      )}
                      <Button
                        size="sm"
                        mt={2}
                        colorScheme="teal"
                        onClick={() => setRouteToHospital(hospital)}
                      >
                        Get Directions
                      </Button>
                      <Button
                        size="sm"
                        mt={2}
                        colorScheme="red"
                        as="a"
                        href={`tel:${hospital.phoneNumber}`}
                      >
                        Call Hospital
                      </Button>
                    </Flex>
                  ))}

                {filteredHospitals.length > 5 && (
                  <Button mt={2} colorScheme="teal" onClick={handleShowMore}>
                    {showMore ? "Show Less" : "Show More"}
                  </Button>
                )}
              </VStack>
            </Box>
          </Collapse>
          <HStack spacing={4} mt={4}>
            <ButtonGroup variant="outline" spacing="6">
              <Button leftIcon={<FaLocationArrow />} onClick={useMyLocation}>
                Use My Location
              </Button>
              <Button leftIcon={<FaAmbulance />} onClick={startRoute}>
                Start Route
              </Button>
              <Button leftIcon={<FaTimes />} onClick={clearRoute}>
                Clear
              </Button>
              <Button leftIcon={<FaHospital />} onClick={locateHospitalsNearMe}>
                Locate Hospitals Near Me
              </Button>
            </ButtonGroup>
          </HStack>
          {distance && duration && (
            <Box mt={4}>
              <Text>
                <strong>Distance:</strong> {distance}
              </Text>
              <Text>
                <strong>Duration:</strong> {duration}
              </Text>
              <Text>
                <strong>Weather:</strong> {weather}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="white"
        p={3}
        shadow="md
  "
        textAlign="center"
      >
        {" "}
        <Text fontSize="sm"> 🚑 Made by Team Logic Lords </Text>{" "}
      </Box>{" "}
    </Flex>
  );
}

export default App;
