// src/components/TrafficInfo.js
import React, { useState } from 'react';
import { Box, Button, Text, VStack, Collapse } from '@chakra-ui/react';
import { FaInfoCircle } from 'react-icons/fa';

const TrafficInfo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Box
      position="fixed"
      bottom={4}
      right={4}
      p={2}
      bg="white"
      shadow="md"
      borderRadius="md"
      width="300px"
      zIndex={1}
    >
      <Button
        variant="outline"
        colorScheme="blue"
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<FaInfoCircle />}
        mb={2}
        width="100%"
      >
        Traffic Info
      </Button>
      <Collapse in={isOpen}>
        <VStack align="start" spacing={2}>
          <Box>
            <Text fontSize="md" fontWeight="bold" color="green.500">
              Green Line
            </Text>
            <Text fontSize="sm">
              Indicates light or clear traffic conditions. You can expect a smooth journey with minimal delays.
            </Text>
          </Box>
          <Box>
            <Text fontSize="md" fontWeight="bold" color="yellow.500">
              Yellow Line
            </Text>
            <Text fontSize="sm">
              Represents moderate traffic conditions. There may be some delays, but traffic is still moving relatively well.
            </Text>
          </Box>
          <Box>
            <Text fontSize="md" fontWeight="bold" color="red.500">
              Red Line
            </Text>
            <Text fontSize="sm">
              Indicates heavy traffic conditions or a traffic jam. Significant delays are expected, and you should plan for possible detours.
            </Text>
          </Box>
          <Box>
            <Text fontSize="md" fontWeight="bold" color="gray.500">
              Gray Line
            </Text>
            <Text fontSize="sm">
              Indicates that traffic information is not available for that section of the road.
            </Text>
          </Box>
        </VStack>
      </Collapse>
    </Box>
  );
};

export default TrafficInfo;
