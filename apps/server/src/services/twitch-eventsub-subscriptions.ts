import type { TwitchEventSubSubscriptionType } from "@streamops/shared";
import { TWITCH_EVENTSUB_SUBSCRIPTION_TYPES } from "@streamops/shared";

export type EventSubSubscriptionContext = {
  broadcasterUserId: string;
  chatUserId: string;
};

export type EventSubSubscriptionDefinition = {
  type: TwitchEventSubSubscriptionType;
  version: string;
  requiredScopes: string[];
  satisfiedByScopes?: string[];
  buildCondition: (context: EventSubSubscriptionContext) => Record<string, string>;
};

const knownTypes = new Set<string>(TWITCH_EVENTSUB_SUBSCRIPTION_TYPES);

export const EVENTSUB_SUBSCRIPTION_DEFINITIONS: Record<TwitchEventSubSubscriptionType, EventSubSubscriptionDefinition> = {
  "stream.online": {
    type: "stream.online",
    version: "1",
    requiredScopes: [],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "stream.offline": {
    type: "stream.offline",
    version: "1",
    requiredScopes: [],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "channel.chat.message": {
    type: "channel.chat.message",
    version: "1",
    requiredScopes: ["user:read:chat"],
    buildCondition: ({ broadcasterUserId, chatUserId }) => ({ broadcaster_user_id: broadcasterUserId, user_id: chatUserId })
  },
  "channel.channel_points_custom_reward_redemption.add": {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    requiredScopes: ["channel:read:redemptions"],
    satisfiedByScopes: ["channel:read:redemptions", "channel:manage:redemptions"],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "channel.subscribe": {
    type: "channel.subscribe",
    version: "1",
    requiredScopes: ["channel:read:subscriptions"],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "channel.subscription.message": {
    type: "channel.subscription.message",
    version: "1",
    requiredScopes: ["channel:read:subscriptions"],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "channel.cheer": {
    type: "channel.cheer",
    version: "1",
    requiredScopes: ["bits:read"],
    buildCondition: ({ broadcasterUserId }) => ({ broadcaster_user_id: broadcasterUserId })
  },
  "channel.raid": {
    type: "channel.raid",
    version: "1",
    requiredScopes: [],
    buildCondition: ({ broadcasterUserId }) => ({ to_broadcaster_user_id: broadcasterUserId })
  },
  "channel.follow": {
    type: "channel.follow",
    version: "2",
    requiredScopes: ["moderator:read:followers"],
    buildCondition: ({ broadcasterUserId, chatUserId }) => ({
      broadcaster_user_id: broadcasterUserId,
      moderator_user_id: chatUserId
    })
  }
};

export function isKnownEventSubSubscriptionType(type: string): type is TwitchEventSubSubscriptionType {
  return knownTypes.has(type);
}

export function getEventSubDefinition(type: string): EventSubSubscriptionDefinition | undefined {
  if (!isKnownEventSubSubscriptionType(type)) return undefined;
  return EVENTSUB_SUBSCRIPTION_DEFINITIONS[type];
}

export function getMissingScopesForEventSubDefinition(
  definition: EventSubSubscriptionDefinition,
  grantedScopes: readonly string[]
): string[] {
  const granted = new Set(grantedScopes);
  if (definition.satisfiedByScopes?.some((scope) => granted.has(scope))) return [];
  return definition.requiredScopes.filter((scope) => !granted.has(scope));
}

export function getMissingScopesForEventSubTypes(types: readonly string[], grantedScopes: readonly string[]): string[] {
  const missing = new Set<string>();
  for (const type of types) {
    const definition = getEventSubDefinition(type);
    if (!definition) continue;
    for (const scope of getMissingScopesForEventSubDefinition(definition, grantedScopes)) {
      missing.add(scope);
    }
  }
  return [...missing];
}
