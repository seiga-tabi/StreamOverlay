import {
  streamerChannelHandle,
  streamerChannelKey,
  streamerPlatformFromChannelKey,
  type StreamerPlatform
} from "@streamops/shared";

export function parseStreamerHandleInput(value: string): { handle: string; platform?: StreamerPlatform } {
  const channelKey = streamerChannelKey(value);
  if (!channelKey) return { handle: value };
  const parsedHandle = streamerChannelHandle(channelKey);
  const parsedPlatform = streamerPlatformFromChannelKey(channelKey);
  return parsedHandle && parsedPlatform
    ? { handle: parsedHandle, platform: parsedPlatform }
    : { handle: value };
}
