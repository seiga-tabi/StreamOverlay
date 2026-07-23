import {
  assertPalworldBreedingArtifact,
  type PalworldBreedingArtifact,
  type PalworldBreedingGender,
  type PalworldBreedingPalParameter,
  type PalworldBreedingSpecialRule
} from "../data/palworld-breeding-artifact.js";

export type PalworldBreedingEnginePair = {
  parentAId: string;
  parentBId: string;
  childId: string;
  isSpecial: boolean;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
};

export type PalworldBreedingEngineResolution =
  | {
      state: "resolved";
      result: PalworldBreedingEnginePair;
      alternatives: [];
    }
  | {
      state: "requires_gender";
      alternatives: PalworldBreedingEnginePair[];
    }
  | {
      state: "not_found";
      alternatives: [];
    };

export type PalworldBreedingEngineQuery = {
  parentAId: string;
  parentBId: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
};

function unorderedPairKey(parentAId: string, parentBId: string): string {
  return parentAId <= parentBId
    ? `${parentAId}\0${parentBId}`
    : `${parentBId}\0${parentAId}`;
}

function ruleForRequestedOrder(
  rule: PalworldBreedingSpecialRule,
  query: PalworldBreedingEngineQuery
): PalworldBreedingEnginePair | undefined {
  if (rule.parentAId === query.parentAId && rule.parentBId === query.parentBId) {
    return {
      parentAId: query.parentAId,
      parentBId: query.parentBId,
      childId: rule.childId,
      isSpecial: true,
      ...(rule.parentAGender === undefined ? {} : { parentAGender: rule.parentAGender }),
      ...(rule.parentBGender === undefined ? {} : { parentBGender: rule.parentBGender })
    };
  }
  if (rule.parentAId === query.parentBId && rule.parentBId === query.parentAId) {
    return {
      parentAId: query.parentAId,
      parentBId: query.parentBId,
      childId: rule.childId,
      isSpecial: true,
      ...(rule.parentBGender === undefined ? {} : { parentAGender: rule.parentBGender }),
      ...(rule.parentAGender === undefined ? {} : { parentBGender: rule.parentAGender })
    };
  }
  return undefined;
}

function genderMatches(
  required: PalworldBreedingGender | undefined,
  selected: PalworldBreedingGender | undefined
): boolean {
  return selected === undefined || required === undefined || required === selected;
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pairOrder(left: PalworldBreedingEnginePair, right: PalworldBreedingEnginePair): number {
  return codePointCompare(left.parentAId, right.parentAId)
    || codePointCompare(left.parentBId, right.parentBId)
    || codePointCompare(left.parentAGender ?? "", right.parentAGender ?? "")
    || codePointCompare(left.parentBGender ?? "", right.parentBGender ?? "")
    || codePointCompare(left.childId, right.childId);
}

export class PalworldBreedingEngine {
  readonly available = true;
  readonly metadata: PalworldBreedingArtifact["metadata"];
  readonly pairCount: number;
  readonly generalCandidateCount: number;

  private readonly parametersById: ReadonlyMap<string, PalworldBreedingPalParameter>;
  private readonly parameters: readonly PalworldBreedingPalParameter[];
  private readonly generalCandidates: readonly PalworldBreedingPalParameter[];
  private readonly specialRulesByPair: ReadonlyMap<string, readonly PalworldBreedingSpecialRule[]>;
  private readonly reverseIndex: ReadonlyMap<string, readonly PalworldBreedingEnginePair[]>;

  constructor(snapshot: unknown) {
    const artifact = assertPalworldBreedingArtifact(snapshot);
    this.metadata = artifact.metadata;
    this.parameters = artifact.parameters;
    this.parametersById = new Map(artifact.parameters.map((parameter) => [parameter.palId, parameter]));

    const specialRulesByPair = new Map<string, PalworldBreedingSpecialRule[]>();
    const nonSelfSpecialRules = artifact.specialRules.filter((rule) =>
      !(rule.parentAId === rule.parentBId && rule.parentAId === rule.childId)
    );
    for (const rule of nonSelfSpecialRules) {
      const key = unorderedPairKey(rule.parentAId, rule.parentBId);
      specialRulesByPair.set(key, [...(specialRulesByPair.get(key) ?? []), rule]);
    }
    this.specialRulesByPair = specialRulesByPair;

    const specialOnlyChildren = new Set(nonSelfSpecialRules.map((rule) => rule.childId));
    this.generalCandidates = artifact.parameters.filter((parameter) => !specialOnlyChildren.has(parameter.palId));
    this.generalCandidateCount = this.generalCandidates.length;

    const reverseIndex = new Map<string, PalworldBreedingEnginePair[]>();
    let pairCount = 0;
    for (let parentAIndex = 0; parentAIndex < this.parameters.length; parentAIndex += 1) {
      const parentA = this.parameters[parentAIndex]!;
      for (let parentBIndex = parentAIndex; parentBIndex < this.parameters.length; parentBIndex += 1) {
        const parentB = this.parameters[parentBIndex]!;
        const resolution = this.resolve({ parentAId: parentA.palId, parentBId: parentB.palId });
        const pairs = resolution.state === "resolved"
          ? [resolution.result]
          : resolution.state === "requires_gender"
            ? resolution.alternatives
            : [];
        for (const pair of pairs) {
          reverseIndex.set(pair.childId, [...(reverseIndex.get(pair.childId) ?? []), pair]);
          pairCount += 1;
        }
      }
    }
    for (const [childId, pairs] of reverseIndex) {
      reverseIndex.set(childId, [...pairs].sort(pairOrder));
    }
    this.reverseIndex = reverseIndex;
    this.pairCount = pairCount;
  }

  resolve(query: PalworldBreedingEngineQuery): PalworldBreedingEngineResolution {
    const parentA = this.parametersById.get(query.parentAId);
    const parentB = this.parametersById.get(query.parentBId);
    if (!parentA || !parentB) return { state: "not_found", alternatives: [] };

    if (parentA.palId === parentB.palId) {
      return {
        state: "resolved",
        result: {
          parentAId: query.parentAId,
          parentBId: query.parentBId,
          childId: parentA.palId,
          isSpecial: false
        },
        alternatives: []
      };
    }

    const specialRules = this.specialRulesByPair.get(unorderedPairKey(query.parentAId, query.parentBId)) ?? [];
    if (specialRules.length > 0) {
      const matches = specialRules
        .map((rule) => ruleForRequestedOrder(rule, query))
        .filter((pair): pair is PalworldBreedingEnginePair =>
          pair !== undefined
          && genderMatches(pair.parentAGender, query.parentAGender)
          && genderMatches(pair.parentBGender, query.parentBGender)
        )
        .sort(pairOrder);
      if (matches.length === 1) {
        return { state: "resolved", result: matches[0]!, alternatives: [] };
      }
      if (matches.length > 1) {
        return { state: "requires_gender", alternatives: matches };
      }
      return { state: "not_found", alternatives: [] };
    }

    const targetRank = Math.floor((parentA.combiRank + parentB.combiRank + 1) / 2);
    const child = this.generalCandidates
      .map((candidate) => ({
        candidate,
        distance: Math.abs(candidate.combiRank - targetRank)
      }))
      .sort((left, right) =>
        left.distance - right.distance
        || right.candidate.combiDuplicatePriority - left.candidate.combiDuplicatePriority
        || Number(left.candidate.variantType === "variant") - Number(right.candidate.variantType === "variant")
        || codePointCompare(left.candidate.palId, right.candidate.palId)
      )[0]?.candidate;
    if (!child) return { state: "not_found", alternatives: [] };
    return {
      state: "resolved",
      result: {
        parentAId: query.parentAId,
        parentBId: query.parentBId,
        childId: child.palId,
        isSpecial: false
      },
      alternatives: []
    };
  }

  parents(childId: string): PalworldBreedingEnginePair[] {
    return [...(this.reverseIndex.get(childId) ?? [])];
  }
}
