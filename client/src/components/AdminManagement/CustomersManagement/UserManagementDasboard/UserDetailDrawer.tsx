import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerCloseButton,
  DrawerBody,
  DrawerFooter,
  VStack,
  HStack,
  Box,
  Text,
  Badge,
  Flex,
  Avatar,
  Heading,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  Icon,
  Alert,
  AlertIcon,
  AlertDescription,
  ButtonGroup,
  Button,
  useColorModeValue,
  Input,
  Stack,
  useToast,
  Select,
} from '@chakra-ui/react';
import {
  FiCalendar,
  FiActivity,
  FiUserX,
  FiUserCheck,
  FiRefreshCw,
  FiMail,
  FiPhone,
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi';
import {
  useCanManageUser,
  useUpdateProfile,
  useUserById,
  useUserOnlineStatus,
} from '@/context/AuthContextService';
import { LoadingState } from './LoadingState';
import { useUserActions } from './UserActions';
import { useEffect, useState } from 'react';
import type { UserRole } from '@/type/auth';

interface UserDrawerProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (userId: string, action: string) => void;
}

export const UserDetailsDrawer = ({
  userId,
  isOpen,
  onClose,
  onAction,
}: UserDrawerProps) => {
  const bgGradient = 'linear(to-br, blue.100, purple.50)';
  const cardBg = useColorModeValue('white', 'gray.700');
  const headerBg = useColorModeValue('white', 'gray.800');
  const statBg = useColorModeValue('gray.50', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  //Email state
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const toast = useToast();
  const { canDeactivate, canActivate, canInvalidateTokens } =
    useCanManageUser(userId);

  const { data: user, isLoading, error, refetch } = useUserById(userId);
  const { isOnline } = useUserOnlineStatus();
  const updateEmailMutation = useUpdateProfile();
  const { handleRoleChange } = useUserActions();

  // Use the shared user actions hook
  const {
    handleUserAction,
    isActivating,
    isDeactivating,
    isInvalidatingTokens,
  } = useUserActions();

  // Initialize email state when user data is loaded
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const handleSaveChange = async () => {
    if (!user?._id) {
      return;
    }

    if (!email) {
      toast({
        title: 'Empty field!',
        description: "You can't save an empty field",
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await updateEmailMutation.mutateAsync({
        id: user?._id,
        updates: { email },
      });

      toast({
        title: 'Email changed successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setIsEditing(false);
      await refetch();
    } catch (error) {
      console.log(error);
      toast({
        title: 'Change failed!',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCancelEdit = () => {
    setEmail(user?.email || '');
    setIsEditing(false);
  };

  const handleAction = async (action: string) => {
    const success = await handleUserAction(userId, action);

    if (success) {
      await refetch();
      if (onAction) {
        onAction(userId, action);
      }
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement='right' size='lg'>
      <DrawerOverlay bg='blackAlpha.600' backdropFilter='blur(10px)' />
      <DrawerContent bg={cardBg} shadow='2xl'>
        <DrawerHeader
          bg={headerBg}
          borderBottom='1px'
          borderColor={borderColor}
          fontSize='xl'
          fontWeight='600'
        >
          User Details
        </DrawerHeader>
        <DrawerCloseButton />

        <DrawerBody p={0}>
          {isLoading ? (
            <Box p={6}>
              <LoadingState />
            </Box>
          ) : error || !user ? (
            <Box p={6}>
              <Alert status='error' borderRadius='xl'>
                <AlertIcon />
                <AlertDescription>
                  {error ? 'Failed to load user details.' : 'User not found.'}
                </AlertDescription>
              </Alert>
            </Box>
          ) : (
            <>
              <Box bgGradient={bgGradient} p={6} position='relative'>
                <Flex align='center' justify='center' direction='column'>
                  <Box position='relative'>
                    <Avatar
                      size='xl'
                      name={user.name}
                      src={user.avatar}
                      border='4px solid'
                      borderColor='white'
                      shadow='xl'
                    />
                    <Box
                      position='absolute'
                      bottom='1'
                      right='1'
                      w='4'
                      h='4'
                      bg={isOnline ? 'green.400' : 'gray.400'}
                      borderRadius='full'
                      border='2px solid white'
                    />
                  </Box>
                  <Heading size='md' mt={4} mb={1} textAlign='center'>
                    {user.name}
                  </Heading>
                  <Text color='gray.600' fontSize='md' mb={4}>
                    {user.email}
                  </Text>
                  <HStack spacing={3}>
                    <Badge
                      colorScheme={user.isActive ? 'green' : 'red'}
                      px={3}
                      py={1}
                      borderRadius='full'
                      fontWeight='600'
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge
                      colorScheme='blue'
                      px={3}
                      py={1}
                      borderRadius='full'
                      textTransform='capitalize'
                      fontWeight='600'
                    >
                      {user.role}
                    </Badge>
                  </HStack>
                </Flex>
              </Box>

              <VStack spacing={6} p={6}>
                {/* User Stats with Enhanced Cards */}
                <Grid templateColumns='repeat(2, 1fr)' gap={4} w='full'>
                  <GridItem>
                    <Box
                      bg={statBg}
                      p={4}
                      borderRadius='xl'
                      border='1px'
                      borderColor={borderColor}
                    >
                      <Stat>
                        <StatLabel>
                          <HStack color='gray.600'>
                            <Icon as={FiCalendar} />
                            <Text fontWeight='500' fontSize='sm'>
                              Joined
                            </Text>
                          </HStack>
                        </StatLabel>
                        <StatNumber fontSize='md' fontWeight='700' mt={1}>
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )
                            : 'N/A'}
                        </StatNumber>
                      </Stat>
                    </Box>
                  </GridItem>
                  <GridItem>
                    <Box
                      bg={statBg}
                      p={4}
                      borderRadius='xl'
                      border='1px'
                      borderColor={borderColor}
                    >
                      <Stat>
                        <StatLabel>
                          <HStack color='gray.600'>
                            <Icon as={FiActivity} />
                            <Text fontWeight='500' fontSize='sm'>
                              Last Active
                            </Text>
                          </HStack>
                        </StatLabel>
                        <StatNumber fontSize='md' fontWeight='700' mt={1}>
                          {user.lastSeen
                            ? new Date(user.lastSeen).toLocaleDateString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                }
                              )
                            : 'Never'}
                        </StatNumber>
                      </Stat>
                    </Box>
                  </GridItem>
                </Grid>

                {/* Enhanced Additional Info */}
                <Box w='full'>
                  <Heading size='sm' mb={4} color='gray.700'>
                    Account Information
                  </Heading>

                  <VStack spacing={4} align='stretch'>
                    <Box
                      bg={statBg}
                      p={4}
                      borderRadius='xl'
                      border='1px'
                      borderColor={borderColor}
                    >
                      <HStack justify='space-between' align='center'>
                        <HStack>
                          <Icon as={FiMail} color='gray.500' />
                          <Text fontWeight='600' color='gray.700' fontSize='sm'>
                            Email Verified
                          </Text>
                        </HStack>
                        <HStack>
                          <Icon
                            as={
                              user.isEmailVerified ? FiCheckCircle : FiXCircle
                            }
                            color={
                              user.isEmailVerified ? 'green.500' : 'red.500'
                            }
                          />
                          <Badge
                            colorScheme={user.isEmailVerified ? 'green' : 'red'}
                            borderRadius='full'
                            px={3}
                            py={1}
                            fontSize='xs'
                          >
                            {user.isEmailVerified ? 'Verified' : 'Not Verified'}
                          </Badge>
                        </HStack>
                      </HStack>
                    </Box>

                    {user.phone && (
                      <Box
                        bg={statBg}
                        p={4}
                        borderRadius='xl'
                        border='1px'
                        borderColor={borderColor}
                      >
                        <HStack justify='space-between'>
                          <HStack>
                            <Icon as={FiPhone} color='gray.500' />
                            <Text
                              fontWeight='600'
                              color='gray.700'
                              fontSize='sm'
                            >
                              Phone Number
                            </Text>
                          </HStack>
                          <Text fontWeight='500' fontSize='sm'>
                            {user.phone}
                          </Text>
                        </HStack>
                      </Box>
                    )}

                    {user.profileCompletion && (
                      <Box
                        bg={statBg}
                        p={4}
                        borderRadius='xl'
                        border='1px'
                        borderColor={borderColor}
                      >
                        <HStack justify='space-between'>
                          <Text fontWeight='600' color='gray.700' fontSize='sm'>
                            Profile Completion
                          </Text>
                          <HStack>
                            <Box
                              w='16'
                              h='2'
                              bg='gray.200'
                              borderRadius='full'
                              overflow='hidden'
                            >
                              <Box
                                w={`${user.profileCompletion}%`}
                                h='full'
                                bg='green.400'
                                transition='width 0.3s'
                              />
                            </Box>
                            <Text
                              fontWeight='700'
                              color='green.600'
                              fontSize='sm'
                            >
                              {user.profileCompletion}%
                            </Text>
                          </HStack>
                        </HStack>
                      </Box>
                    )}
                  </VStack>
                </Box>

                {/* Activity Status */}
                {user.isActive && (
                  <Box w='full'>
                    <Heading size='sm' mb={4} color='gray.700'>
                      Current Status
                    </Heading>
                    <Box
                      bg={statBg}
                      p={4}
                      borderRadius='xl'
                      border='1px'
                      borderColor={borderColor}
                    >
                      <HStack justify='space-between'>
                        <HStack>
                          <Box
                            w='3'
                            h='3'
                            bg={isOnline ? 'green.400' : 'gray.400'}
                            borderRadius='full'
                            animation={isOnline ? 'pulse 2s infinite' : 'none'}
                          />
                          <Text fontWeight='600' color='gray.700' fontSize='sm'>
                            Connection Status
                          </Text>
                        </HStack>
                        <Badge
                          colorScheme={isOnline ? 'green' : 'gray'}
                          borderRadius='full'
                          px={3}
                          py={1}
                          fontWeight='600'
                          fontSize='xs'
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </HStack>
                    </Box>
                    {/**Change role */}
                    <Stack
                      my={4}
                      fontWeight='600'
                      color='gray.700'
                      fontSize='sm'
                    >
                      <Flex>
                        Change User{' '}
                        <Text ml={2} color='red' fontWeight='bold'>
                          Role:
                        </Text>{' '}
                      </Flex>
                      <Select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user._id, e.target.value as UserRole)
                        }
                        size='sm'
                        variant='filled'
                        width='full'
                        borderRadius='xl'
                      >
                        <option value='admin'>Admin</option>
                        <option value='vendor'>Vendor</option>
                        <option value='customer'>Customer</option>
                      </Select>
                    </Stack>
                    {/**Email Edit Section */}
                    <Stack
                      my={4}
                      fontWeight='600'
                      color='gray.700'
                      fontSize='sm'
                    >
                      <Text>Change User Email Address: </Text>
                      <Input
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        isReadOnly={!isEditing}
                        bg={isEditing ? 'white' : 'gray.50'}
                        cursor={isEditing ? 'text' : 'default'}
                        _focus={isEditing ? {} : { boxShadow: 'none' }}
                      />
                      <HStack spacing={2}>
                        {!isEditing ? (
                          <Button
                            onClick={() => setIsEditing(true)}
                            colorScheme='blue'
                            size='sm'
                          >
                            Change Email
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={handleSaveChange}
                              colorScheme='green'
                              size='sm'
                              isLoading={updateEmailMutation.isPending}
                              loadingText='Saving...'
                            >
                              Save Changes
                            </Button>
                            <Button
                              onClick={handleCancelEdit}
                              variant='outline'
                              size='sm'
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </HStack>
                    </Stack>
                  </Box>
                )}
              </VStack>
            </>
          )}
        </DrawerBody>

        <DrawerFooter bg={headerBg} borderTop='1px' borderColor={borderColor}>
          {!isLoading && !error && user && (
            <ButtonGroup spacing={3} w='full' justifyContent='flex-end'>
              <Button
                onClick={onClose}
                borderRadius='xl'
                variant='ghost'
                size='sm'
              >
                Close
              </Button>

              {canInvalidateTokens && (
                <Button
                  colorScheme='orange'
                  leftIcon={<FiRefreshCw />}
                  borderRadius='xl'
                  onClick={() => handleAction('invalidate')}
                  isLoading={isInvalidatingTokens}
                  loadingText='Invalidating...'
                  size='sm'
                >
                  Invalidate Tokens
                </Button>
              )}

              {canDeactivate && user.isActive && (
                <Button
                  colorScheme='red'
                  leftIcon={<FiUserX />}
                  borderRadius='xl'
                  onClick={() => handleAction('deactivate')}
                  isLoading={isDeactivating}
                  loadingText='Deactivating...'
                  size='sm'
                >
                  Deactivate
                </Button>
              )}

              {canActivate && !user.isActive && (
                <Button
                  colorScheme='green'
                  leftIcon={<FiUserCheck />}
                  borderRadius='xl'
                  onClick={() => handleAction('activate')}
                  isLoading={isActivating}
                  loadingText='Activating...'
                  size='sm'
                >
                  Activate
                </Button>
              )}
            </ButtonGroup>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
