export { trackingEvents, type TrackingEvent } from './events';
export {
  LOCATION_TASK,
  flushQueue,
  isTrackingRunning,
  pendingLocationCount,
  prepareTracking,
  startTracking,
  stopTracking,
  watchForegroundPosition,
  type PrepareResult,
} from './trackingService';
