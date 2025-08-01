import React from 'react';
import {
  Text,
  Flex,
  Box,
  Card,
  CardBody,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
  useBreakpointValue,
} from '@chakra-ui/react';

export const ErrorUtil = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  status = 'error',
  supportText = 'If the problem persists, please contact support.',
  showSupportText = true,
  minHeight = { base: '150px', md: '200px' },
  maxWidth = '7xl',
  ...alertProps
}) => {
  // Color mode values
  const cardBg = useColorModeValue('white', 'gray.700');
  const cardPadding = useBreakpointValue({ base: 4, md: 6 });

  return (
    <Box p={cardPadding} maxW={maxWidth} mx='auto'>
      <Card bg={cardBg} borderRadius='xl' boxShadow='sm'>
        <CardBody>
          <Alert
            status={status}
            borderRadius='lg'
            variant='left-accent'
            flexDirection='column'
            alignItems='flex-start'
            minHeight={minHeight}
            {...alertProps}
          >
            <Flex>
              <AlertIcon boxSize='24px' mt={1} />
              <Box ml={3}>
                <AlertTitle fontSize={{ base: 'md', md: 'lg' }}>
                  {title}
                </AlertTitle>
                <AlertDescription mt={2}>
                  {message}
                  {showSupportText && (
                    <Text mt={2} fontSize='sm' color='gray.600'>
                      {supportText}
                    </Text>
                  )}
                </AlertDescription>
              </Box>
            </Flex>
          </Alert>
        </CardBody>
      </Card>
    </Box>
  );
};
