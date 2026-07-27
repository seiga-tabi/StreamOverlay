/**
 * `import-palworld-item-details.ts`가 고정된 운영자 export에서 생성합니다.
 * sourceInternalId exact join이 실패한 행은 포함하지 않으며 수동 편집하지 않습니다.
 */
export type PalworldGeneratedItemRecipeSource = {
  sourceRowId: string;
  resultCount: number;
  workAmount: number;
  materials: Array<{ sourceInternalId: string; quantity: number }>;
};

export type PalworldGeneratedItemDetailSource = {
  recipes?: PalworldGeneratedItemRecipeSource[];
  merchant?: true;
  chest?: true;
  gathering?: true;
};

export type PalworldGeneratedFacilityRule = {
  sourceRowId: string;
  targetTypesA: string[];
  targetTypesB: string[];
  targetRankMax: number;
};

export const PALWORLD_ITEM_DETAIL_SOURCE = Object.freeze({
  "blueprintArchiveSha256": "633316b83bec9d8d2a07fae7e76ba877cb794fcbe9ca2ea407f109b3e7ca066d",
  "contentArchiveSha256": "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384",
  "deltaArchiveSha256": "2108e7bd6029117473b2ff38d5c9884ec6b717af7645b11e4db44b9b0459a443",
  "catalogSha256": "9ee539c494a9785680a56d96c0dff810ee5433ff1f3f75628be238b7cf268552",
  "recipeTableSha256": "081bbdb225b58ce7fadace96bbc283b95215095c6759ccb79429db308bbaf766",
  "mapObjectTableSha256": "970d712da36afbcb4ba8320e89af9a11c7ce9f77b6d88ebf72b2f3efb66a2942",
  "technologyTableSha256": "b9f98dd1966e0be1786b29ac2361930fbfb61cecca399f0248cd1246277b8975",
  "shopTableSha256": "73e85b1eef9340fc18d18a796a6dbabc413a9724bf2b160a5c4a0546602b8fe4",
  "chestTableSha256": "48d51e5add54d35e3e617aef23467eaacf04949b7ec889bbaaa67b8aad5594be",
  "productTableSha256": "cf354f0730c53800872e78e121e8b7b6af7f0a88df3ef4b87845050c67e6417f",
  "catalogItems": 1847,
  "recipeRowsForCatalog": 1243,
  "publishedRecipeRows": 1237,
  "excludedRecipeRows": 6,
  "recipeProducts": 1222,
  "merchantItems": 266,
  "chestItems": 784,
  "gatheringItems": 13,
  "craftingFacilities": 33
});

export const PALWORLD_ITEM_DETAILS_BY_SOURCE_INTERNAL_ID = Object.freeze(
{
  "Accessory_AirDash1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_AirDash1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Accessory_AirDash2": {
    "recipes": [
      {
        "sourceRowId": "Accessory_AirDash2",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_AirDash3": {
    "recipes": [
      {
        "sourceRowId": "Accessory_AirDash3",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 150
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "Accessory_AquaResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_AquaResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_AT_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_AT_1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Accessory_Avoid_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Avoid_1",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 10
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_ColdIce_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_ColdIce_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 30
          },
          {
            "sourceInternalId": "Lava_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_CoolResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_CoolResist_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Wool",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Accessory_DarkResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_DarkResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_defense_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_defense_1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperOre",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Accessory_DFHP_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_DFHP_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Honey",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 35
          },
          {
            "sourceInternalId": "Lava_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_DragonResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_DragonResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_EarthResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_EarthResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_ExplosionResist": {
    "recipes": [
      {
        "sourceRowId": "Accessory_ExplosionResist",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "UniqueMaterial_Mothman",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood_WorldTree",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "Accessory_FireResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_FireResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_HCHP_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HCHP_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Polymer",
            "quantity": 30
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_HCMW_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HCMW_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Polymer",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_HeatColdResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HeatColdResist_1",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Cloth2",
            "quantity": 40
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Accessory_HeatFire_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HeatFire_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Wood_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_HeatResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HeatResist_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Wool",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 35
          }
        ]
      }
    ]
  },
  "Accessory_HP_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_HP_1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Accessory_IceResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_IceResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_JumpAir_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_JumpAir_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 15
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Wood_Ancient",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Accessory_JumpAir_2": {
    "recipes": [
      {
        "sourceRowId": "Accessory_JumpAir_2",
        "resultCount": 1,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 25
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 40
          },
          {
            "sourceInternalId": "Lava_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_JumpCount_Increase1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_JumpCount_Increase1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Accessory_JumpCount_Increase2": {
    "recipes": [
      {
        "sourceRowId": "Accessory_JumpCount_Increase2",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 150
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "Accessory_JumpPower_Increase": {
    "recipes": [
      {
        "sourceRowId": "Accessory_JumpPower_Increase",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Accessory_LeafResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_LeafResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalItem_PlantSlime",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_MaxWeightUp_01": {
    "recipes": [
      {
        "sourceRowId": "Accessory_MaxWeightUp_01",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Accessory_NonkChecker_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_NonkChecker_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood_Ancient",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Accessory_Nonkilling": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Nonkilling",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_NormalResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_NormalResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cement",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Dargon_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Dargon_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Dark_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Dark_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalItem_CatMage",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Earth_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Earth_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Electricity_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Electricity_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Fire_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Fire_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Fire_2": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Fire_2",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Ice_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Ice_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Leaf_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Leaf_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "TomatoSeeds",
            "quantity": 10
          },
          {
            "sourceInternalId": "OnionSeeds",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_Otomo_Water_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_Otomo_Water_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_PPAT_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_PPAT_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 35
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_PPDF_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_PPDF_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Chromium",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 35
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_SuperJumpAir_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_SuperJumpAir_1",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 35
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 50
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_SuperJumpAir_2": {
    "recipes": [
      {
        "sourceRowId": "Accessory_SuperJumpAir_2",
        "resultCount": 1,
        "workAmount": 350000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 45
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 60
          },
          {
            "sourceInternalId": "BeastBone_Ancient",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "Accessory_TalentChecker": {
    "recipes": [
      {
        "sourceRowId": "Accessory_TalentChecker",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Accessory_ThunderResist_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_ThunderResist_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_WKMC_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_WKMC_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 35
          },
          {
            "sourceInternalId": "Wood_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Accessory_WorkSpeed_1": {
    "recipes": [
      {
        "sourceRowId": "Accessory_WorkSpeed_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "AdditionalInventory_001": {
    "recipes": [
      {
        "sourceRowId": "AdditionalInventory_001",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "AdditionalInventory_002": {
    "recipes": [
      {
        "sourceRowId": "AdditionalInventory_002",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 50
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "AdditionalInventory_003": {
    "recipes": [
      {
        "sourceRowId": "AdditionalInventory_003",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 80
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "AdditionalInventory_004": {
    "recipes": [
      {
        "sourceRowId": "AdditionalInventory_004",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 50
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 120
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "AffectionFruit_01": {
    "merchant": true,
    "chest": true
  },
  "AffectionFruit_02": {
    "chest": true
  },
  "AIcore": {
    "recipes": [
      {
        "sourceRowId": "AIcore",
        "resultCount": 1,
        "workAmount": 5000000,
        "materials": [
          {
            "sourceInternalId": "Computer",
            "quantity": 5
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 2
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "AncientArmor": {
    "recipes": [
      {
        "sourceRowId": "AncientArmor",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "AncientArmor_2": {
    "recipes": [
      {
        "sourceRowId": "AncientArmor_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientArmor_3": {
    "recipes": [
      {
        "sourceRowId": "AncientArmor_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "AncientArmor_4": {
    "recipes": [
      {
        "sourceRowId": "AncientArmor_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "AncientArmor_5": {
    "recipes": [
      {
        "sourceRowId": "AncientArmor_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "AncientArmorCold": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorCold",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "AncientArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorCold_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 62
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorCold_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 75
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "AncientArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorCold_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "AncientArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorCold_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 100
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "AncientArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorHeat",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorHeat_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorHeat_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 9
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "AncientArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorHeat_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "AncientArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorHeat_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "AncientArmorWeight": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorWeight",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "AncientArmorWeight_2": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorWeight_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 62
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorWeight_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 75
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "AncientArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorWeight_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 12
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "AncientArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "AncientArmorWeight_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 14
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 100
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "AncientHelmet": {
    "recipes": [
      {
        "sourceRowId": "AncientHelmet",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "AncientHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "AncientHelmet_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "AncientHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "AncientHelmet_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "AncientHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "AncientHelmet_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "AncientHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "AncientHelmet_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "AncientParts2": {
    "chest": true
  },
  "AncientParts3": {
    "chest": true
  },
  "AncientTechnologyBook_G1": {
    "chest": true
  },
  "Arrow": {
    "recipes": [
      {
        "sourceRowId": "Arrow",
        "resultCount": 10,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Arrow_Fire": {
    "recipes": [
      {
        "sourceRowId": "Arrow_Fire",
        "resultCount": 10,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 2
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Arrow_Poison": {
    "recipes": [
      {
        "sourceRowId": "Arrow_Poison",
        "resultCount": 10,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 2
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "AssaultRifle_Default1": {
    "recipes": [
      {
        "sourceRowId": "AssaultRifle_Default1",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "AssaultRifleBullet": {
    "recipes": [
      {
        "sourceRowId": "AssaultRifleBullet",
        "resultCount": 20,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "AutoMealPouch_Tier1": {
    "recipes": [
      {
        "sourceRowId": "AutoMealPouch_Tier1",
        "resultCount": 1,
        "workAmount": 2000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 5
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "AutoMealPouch_Tier2": {
    "recipes": [
      {
        "sourceRowId": "AutoMealPouch_Tier2",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "AutoMealPouch_Tier3": {
    "recipes": [
      {
        "sourceRowId": "AutoMealPouch_Tier3",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "AutoMealPouch_Tier4": {
    "recipes": [
      {
        "sourceRowId": "AutoMealPouch_Tier4",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 90
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 35
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "AutoMealPouch_Tier5": {
    "recipes": [
      {
        "sourceRowId": "AutoMealPouch_Tier5",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 50
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 200
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Axe_Steal": {
    "recipes": [
      {
        "sourceRowId": "Axe_Steal",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 100
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Axe_Tier_00": {
    "recipes": [
      {
        "sourceRowId": "Axe_Tier_00",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Axe_Tier_01": {
    "recipes": [
      {
        "sourceRowId": "Axe_Tier_01",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 15
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Axe_Tier_02": {
    "recipes": [
      {
        "sourceRowId": "Axe_Tier_02",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 4
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "BaconEggs": {
    "recipes": [
      {
        "sourceRowId": "BaconEggs",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_Boar",
            "quantity": 2
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "Baked_Berries": {
    "recipes": [
      {
        "sourceRowId": "Baked_Berries",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Berries",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_BerryGoat": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_BerryGoat",
        "resultCount": 1,
        "workAmount": 1600,
        "materials": [
          {
            "sourceInternalId": "Meat_BerryGoat",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_Boar": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_Boar",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_Boar",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_ChickenPal": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_ChickenPal",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Meat_ChickenPal",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_CowPal": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_CowPal",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_CowPal",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_Deer": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_Deer",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_Deer",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_Eagle": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_Eagle",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_Eagle",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "BakedMeat_GrassMammoth": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_GrassMammoth",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Meat_GrassMammoth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_IceCrocodile": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_IceCrocodile",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_IceCrocodile",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_IceDeer": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_IceDeer",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Meat_IceDeer",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_Kelpie": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_Kelpie",
        "resultCount": 1,
        "workAmount": 1600,
        "materials": [
          {
            "sourceInternalId": "Meat_Kelpie",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_LazyCatfish": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_LazyCatfish",
        "resultCount": 1,
        "workAmount": 1600,
        "materials": [
          {
            "sourceInternalId": "Meat_LazyCatfish",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_SakuraSaurus": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_SakuraSaurus",
        "resultCount": 1,
        "workAmount": 3200,
        "materials": [
          {
            "sourceInternalId": "Meat_SakuraSaurus",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMeat_SheepBall": {
    "recipes": [
      {
        "sourceRowId": "BakedMeat_SheepBall",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Meat_SheepBall",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BakedMushroom": {
    "recipes": [
      {
        "sourceRowId": "BakedMushroom",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Mushroom",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Bat": {
    "recipes": [
      {
        "sourceRowId": "Bat",
        "resultCount": 1,
        "workAmount": 750,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Bat2": {
    "recipes": [
      {
        "sourceRowId": "Bat2",
        "resultCount": 1,
        "workAmount": 2000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 30
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Bat3": {
    "recipes": [
      {
        "sourceRowId": "Bat3",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Bat3_2": {
    "recipes": [
      {
        "sourceRowId": "Bat3_2",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 37
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "Bat3_3": {
    "recipes": [
      {
        "sourceRowId": "Bat3_3",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 45
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Bat3_4": {
    "recipes": [
      {
        "sourceRowId": "Bat3_4",
        "resultCount": 1,
        "workAmount": 960000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 52
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 35
          }
        ]
      }
    ]
  },
  "Bat3_5": {
    "recipes": [
      {
        "sourceRowId": "Bat3_5",
        "resultCount": 1,
        "workAmount": 1920000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 60
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "BeamLauncher": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncher",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 50
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "BeamLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncher_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 125
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 62
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 12
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "BeamLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncher_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 75
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 15
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "BeamLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncher_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 175
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 87
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 17
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "BeamLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncher_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 200
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 100
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 20
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "BeamLauncherBullet": {
    "recipes": [
      {
        "sourceRowId": "BeamLauncherBullet",
        "resultCount": 10,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 6
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "BeamSword": {
    "recipes": [
      {
        "sourceRowId": "BeamSword",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "BeamSword_2": {
    "recipes": [
      {
        "sourceRowId": "BeamSword_2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 125
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 25
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "BeamSword_3": {
    "recipes": [
      {
        "sourceRowId": "BeamSword_3",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 150
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "BeamSword_4": {
    "recipes": [
      {
        "sourceRowId": "BeamSword_4",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 175
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 35
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "BeamSword_5": {
    "recipes": [
      {
        "sourceRowId": "BeamSword_5",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 40
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "Berries": {
    "merchant": true,
    "chest": true
  },
  "BerrySeeds": {
    "merchant": true
  },
  "Bio_Battery": {
    "recipes": [
      {
        "sourceRowId": "Bio_Battery",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 1
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Bio_Coolant": {
    "recipes": [
      {
        "sourceRowId": "Bio_Coolant",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalFluid",
            "quantity": 1
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Blueprint_Accessory_AquaResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_AT_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_Avoid_1_fix": {
    "chest": true
  },
  "Blueprint_Accessory_ColdIce_1": {
    "chest": true
  },
  "Blueprint_Accessory_CoolResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_DarkResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_defense_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_DFHP_1": {
    "chest": true
  },
  "Blueprint_Accessory_DragonResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_EarthResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_FireResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_HCHP_1": {
    "chest": true
  },
  "Blueprint_Accessory_HCMW_1": {
    "chest": true
  },
  "Blueprint_Accessory_HeatColdResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_HeatFire_1": {
    "chest": true
  },
  "Blueprint_Accessory_HeatResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_HP_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_IceResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_JumpAir_1": {
    "chest": true
  },
  "Blueprint_Accessory_JumpAir_2": {
    "chest": true
  },
  "Blueprint_Accessory_LeafResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_MaxWeightUp_01_2": {
    "chest": true
  },
  "Blueprint_Accessory_NonkChecker_1": {
    "chest": true
  },
  "Blueprint_Accessory_NormalResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Dargon_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Dark_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Earth_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Electricity_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Fire_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Fire_2": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Ice_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Leaf_1": {
    "chest": true
  },
  "Blueprint_Accessory_Otomo_Water_1": {
    "chest": true
  },
  "Blueprint_Accessory_PPAT_1": {
    "chest": true
  },
  "Blueprint_Accessory_PPDF_1": {
    "chest": true
  },
  "Blueprint_Accessory_SuperJumpAir_1": {
    "chest": true
  },
  "Blueprint_Accessory_SuperJumpAir_2": {
    "chest": true
  },
  "Blueprint_Accessory_ThunderResist_1_2": {
    "chest": true
  },
  "Blueprint_Accessory_WKMC_1": {
    "chest": true
  },
  "Blueprint_Accessory_WorkSpeed_1_2": {
    "chest": true
  },
  "Blueprint_AncientArmor_2": {
    "chest": true
  },
  "Blueprint_AncientArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorCold_2": {
    "chest": true
  },
  "Blueprint_AncientArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorHeat_2": {
    "chest": true
  },
  "Blueprint_AncientArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorWeight_2": {
    "chest": true
  },
  "Blueprint_AncientArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorWeight_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorWeight_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorWeight_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorWeight_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientArmorWeight_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientArmorWeight_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientHelmet_2": {
    "chest": true
  },
  "Blueprint_AncientHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AncientHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AncientHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AncientHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AssaultRifle_Default2": {
    "chest": true
  },
  "Blueprint_AssaultRifle_Default3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AssaultRifle_Default3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AssaultRifle_Default2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AssaultRifle_Default4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AssaultRifle_Default4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AssaultRifle_Default3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_AssaultRifle_Default5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_AssaultRifle_Default5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_AssaultRifle_Default4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Bat3_2": {
    "chest": true
  },
  "Blueprint_Bat3_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Bat3_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Bat3_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Bat3_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Bat3_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Bat3_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Bat3_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Bat3_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Bat3_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamLauncher_2": {
    "chest": true
  },
  "Blueprint_BeamLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamSword_2": {
    "chest": true
  },
  "Blueprint_BeamSword_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamSword_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamSword_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamSword_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamSword_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamSword_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BeamSword_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BeamSword_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BeamSword_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BowGun_2": {
    "chest": true
  },
  "Blueprint_BowGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BowGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BowGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BowGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BowGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BowGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_BowGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_BowGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_BowGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CandleStand": {
    "chest": true
  },
  "Blueprint_ChargeLaserRifle_2": {
    "chest": true
  },
  "Blueprint_ChargeLaserRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ChargeLaserRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ChargeLaserRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ChargeLaserRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ChargeLaserRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ChargeLaserRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_ChargeLaserRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ChargeLaserRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ChargeLaserRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_ClothArmor_2": {
    "chest": true
  },
  "Blueprint_ClothArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorCold_2": {
    "chest": true
  },
  "Blueprint_ClothArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorHeat_2": {
    "chest": true
  },
  "Blueprint_ClothArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ClothArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ClothArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ClothArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CompoundBow_2": {
    "chest": true
  },
  "Blueprint_CompoundBow_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CompoundBow_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CompoundBow_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CompoundBow_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CompoundBow_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CompoundBow_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CompoundBow_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CompoundBow_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CompoundBow_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ConservationGroupBannerA": {
    "chest": true
  },
  "Blueprint_ConservationGroupBannerB": {
    "chest": true
  },
  "Blueprint_CopperArmor_2": {
    "chest": true
  },
  "Blueprint_CopperArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorCold_2": {
    "chest": true
  },
  "Blueprint_CopperArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorHeat_2": {
    "chest": true
  },
  "Blueprint_CopperArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperHelmet_2": {
    "chest": true
  },
  "Blueprint_CopperHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_CopperHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_CopperHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_CopperHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DoubleBarrelShotgun_2": {
    "chest": true
  },
  "Blueprint_DoubleBarrelShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DoubleBarrelShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DoubleBarrelShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DoubleBarrelShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DoubleBarrelShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DoubleBarrelShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DoubleBarrelShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DoubleBarrelShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DoubleBarrelShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DroneLauncher_2": {
    "chest": true
  },
  "Blueprint_DroneLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DroneLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DroneLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DroneLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DroneLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DroneLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_DroneLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_DroneLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_DroneLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ElectricArcAssaultRifle_2": {
    "chest": true
  },
  "Blueprint_ElectricArcAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ElectricArcAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ElectricArcAssaultRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ElectricArcAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ElectricArcAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ElectricArcAssaultRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_ElectricArcAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_ElectricArcAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_ElectricArcAssaultRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_EnergyRocketLauncher_2": {
    "chest": true
  },
  "Blueprint_EnergyRocketLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyRocketLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyRocketLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_EnergyRocketLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyRocketLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyRocketLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_EnergyRocketLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyRocketLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyRocketLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_EnergyShotgun_2": {
    "chest": true
  },
  "Blueprint_EnergyShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_EnergyShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_EnergyShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_EnergyShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_EnergyShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_FireStand": {
    "chest": true
  },
  "Blueprint_FishingRod_01_2": {
    "chest": true
  },
  "Blueprint_FishingRod_02_2": {
    "chest": true
  },
  "Blueprint_FishingRod_03_2": {
    "chest": true
  },
  "Blueprint_FlameThrower_2": {
    "chest": true
  },
  "Blueprint_FlameThrower_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FlameThrower_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FlameThrower_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FlameThrower_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FlameThrower_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FlameThrower_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FlameThrower_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FlameThrower_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FlameThrower_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmor_2": {
    "chest": true
  },
  "Blueprint_FurArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorCold_2": {
    "chest": true
  },
  "Blueprint_FurArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorHeat_2": {
    "chest": true
  },
  "Blueprint_FurArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurHelmet_2": {
    "chest": true
  },
  "Blueprint_FurHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_FurHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_FurHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_FurHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GatlingGun_2": {
    "chest": true
  },
  "Blueprint_GatlingGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GatlingGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GatlingGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GatlingGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GatlingGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GatlingGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GatlingGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GatlingGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GatlingGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GrenadeLauncher_2": {
    "chest": true
  },
  "Blueprint_GrenadeLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GrenadeLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GrenadeLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GrenadeLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GrenadeLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GrenadeLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GrenadeLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GrenadeLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GrenadeLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GuardianDogStatue": {
    "chest": true
  },
  "Blueprint_GuidedMissileLauncher_2": {
    "chest": true
  },
  "Blueprint_GuidedMissileLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GuidedMissileLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GuidedMissileLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GuidedMissileLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GuidedMissileLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GuidedMissileLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_GuidedMissileLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_GuidedMissileLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_GuidedMissileLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_HandGun_Default_2": {
    "chest": true
  },
  "Blueprint_HandGun_Default_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_HandGun_Default_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_HandGun_Default_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_HandGun_Default_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_HandGun_Default_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_HandGun_Default_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_HandGun_Default_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_HandGun_Default_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_HandGun_Default_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Head001_1": {
    "merchant": true
  },
  "Blueprint_Head002_1": {
    "merchant": true
  },
  "Blueprint_Head003_1": {
    "merchant": true
  },
  "Blueprint_Head004_1": {
    "merchant": true
  },
  "Blueprint_Head005_1": {
    "merchant": true
  },
  "Blueprint_Head006_1": {
    "merchant": true
  },
  "Blueprint_Head007_1": {
    "merchant": true
  },
  "Blueprint_Head008_1": {
    "merchant": true
  },
  "Blueprint_Head009_1": {
    "merchant": true
  },
  "Blueprint_Head010_1": {
    "merchant": true
  },
  "Blueprint_Head011_1": {
    "merchant": true
  },
  "Blueprint_Head012_1": {
    "merchant": true
  },
  "Blueprint_Head013_1": {
    "merchant": true
  },
  "Blueprint_Head014_1": {
    "merchant": true
  },
  "Blueprint_Head015_1": {
    "merchant": true
  },
  "Blueprint_Head016_1": {
    "merchant": true
  },
  "Blueprint_Head017_1": {
    "merchant": true
  },
  "Blueprint_HeadEquip025_1": {
    "merchant": true
  },
  "Blueprint_HeadEquip026_1": {
    "merchant": true
  },
  "Blueprint_HeadEquip028_1": {
    "merchant": true
  },
  "Blueprint_HeadEquip031_1": {
    "merchant": true
  },
  "Blueprint_HeadEquip032_1": {
    "merchant": true
  },
  "Blueprint_Hunter_GangFlag": {
    "chest": true
  },
  "Blueprint_IronArmor_2": {
    "chest": true
  },
  "Blueprint_IronArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorCold_2": {
    "chest": true
  },
  "Blueprint_IronArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorHeat_2": {
    "chest": true
  },
  "Blueprint_IronArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronHelmet_2": {
    "chest": true
  },
  "Blueprint_IronHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_IronHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_IronHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_IronHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Katana_2": {
    "chest": true
  },
  "Blueprint_Katana_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Katana_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Katana_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Katana_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Katana_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Katana_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Katana_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Katana_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Katana_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LanternTop": {
    "chest": true
  },
  "Blueprint_LaserGatlingGun_2": {
    "chest": true
  },
  "Blueprint_LaserGatlingGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserGatlingGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserGatlingGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LaserGatlingGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserGatlingGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserGatlingGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LaserGatlingGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserGatlingGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserGatlingGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LaserRifle_2": {
    "chest": true
  },
  "Blueprint_LaserRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LaserRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LaserRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_LaserRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_LaserRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Launcher_Default_2": {
    "chest": true
  },
  "Blueprint_Launcher_Default_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Launcher_Default_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Launcher_Default_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Launcher_Default_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Launcher_Default_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Launcher_Default_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Launcher_Default_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Launcher_Default_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Launcher_Default_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_LilyQueenStatue": {
    "chest": true
  },
  "Blueprint_MakeshiftAssaultRifle_2": {
    "chest": true
  },
  "Blueprint_MakeshiftAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftAssaultRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftAssaultRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftAssaultRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftHandgun_2": {
    "chest": true
  },
  "Blueprint_MakeshiftHandgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftHandgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftHandgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftHandgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftHandgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftHandgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftHandgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftHandgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftHandgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftShotgun_2": {
    "chest": true
  },
  "Blueprint_MakeshiftShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftSubmachineGun_2": {
    "chest": true
  },
  "Blueprint_MakeshiftSubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftSubmachineGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftSubmachineGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftSubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftSubmachineGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftSubmachineGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MakeshiftSubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MakeshiftSubmachineGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MakeshiftSubmachineGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MultiGuidedMissileLauncher": {
    "chest": true
  },
  "Blueprint_MultiGuidedMissileLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MultiGuidedMissileLauncher_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MultiGuidedMissileLauncher",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MultiGuidedMissileLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MultiGuidedMissileLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MultiGuidedMissileLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MultiGuidedMissileLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MultiGuidedMissileLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MultiGuidedMissileLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_MultiGuidedMissileLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_MultiGuidedMissileLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_MultiGuidedMissileLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Musket_2": {
    "chest": true
  },
  "Blueprint_Musket_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Musket_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Musket_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Musket_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Musket_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Musket_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Musket_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Musket_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Musket_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Octavia001_Armor_5": {
    "merchant": true
  },
  "Blueprint_Octavia002_Armor_5": {
    "merchant": true
  },
  "Blueprint_OctaviaRevolver_5": {
    "merchant": true
  },
  "Blueprint_OctaviaShotgun_5": {
    "merchant": true
  },
  "Blueprint_OldRevolver_2": {
    "chest": true
  },
  "Blueprint_OldRevolver_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OldRevolver_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OldRevolver_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_OldRevolver_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OldRevolver_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OldRevolver_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_OldRevolver_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OldRevolver_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OldRevolver_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Otomo_ATDark_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATDragon_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATEarth_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATElectricity_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATFire_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATIce_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATLeaf_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ATNormal_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_Attack_up1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ATWater_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_Defense_up1_2": {
    "chest": true
  },
  "Blueprint_Otomo_DFDark_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFDragon_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFEarth_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFElectricity_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFFire_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFIce_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFLeaf_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFNormal_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_DFWater_ElementBoost_1": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Dark_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Dragon_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Earth_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Electricity_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Fire_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Ice_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Leaf_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Normal_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_ElementBoost_Water_1_2": {
    "chest": true
  },
  "Blueprint_Otomo_PalConfidence_Increase_1_fix": {
    "chest": true
  },
  "Blueprint_Otomo_PalExp_Increase_1_2": {
    "chest": true
  },
  "Blueprint_OverheatRifle_2": {
    "chest": true
  },
  "Blueprint_OverheatRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OverheatRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OverheatRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_OverheatRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OverheatRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OverheatRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_OverheatRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_OverheatRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_OverheatRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Blueprint_PalSummon_YakushimaBoss002": {
    "chest": true
  },
  "Blueprint_PlasticArmor_2": {
    "chest": true
  },
  "Blueprint_PlasticArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorCold_2": {
    "chest": true
  },
  "Blueprint_PlasticArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorHeat_2": {
    "chest": true
  },
  "Blueprint_PlasticArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorWeight_2": {
    "chest": true
  },
  "Blueprint_PlasticArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorWeight_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorWeight_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorWeight_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorWeight_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticArmorWeight_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticArmorWeight_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticHelmet_2": {
    "chest": true
  },
  "Blueprint_PlasticHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PlasticHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PlasticHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PlasticHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PumpActionShotgun_2": {
    "chest": true
  },
  "Blueprint_PumpActionShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PumpActionShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PumpActionShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PumpActionShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PumpActionShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PumpActionShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_PumpActionShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_PumpActionShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_PumpActionShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoRifle_2": {
    "chest": true
  },
  "Blueprint_SemiAutoRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoShotgun_2": {
    "chest": true
  },
  "Blueprint_SemiAutoShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SemiAutoShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SemiAutoShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SemiAutoShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SF_Chair": {
    "chest": true
  },
  "Blueprint_SF_Desk": {
    "chest": true
  },
  "Blueprint_SFArmor_2": {
    "chest": true
  },
  "Blueprint_SFArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorCold_2": {
    "chest": true
  },
  "Blueprint_SFArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorHeat_2": {
    "chest": true
  },
  "Blueprint_SFArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorWeight_2": {
    "chest": true
  },
  "Blueprint_SFArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorWeight_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorWeight_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorWeight_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorWeight_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFArmorWeight_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFArmorWeight_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFBow_2": {
    "chest": true
  },
  "Blueprint_SFBow_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFBow_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFBow_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFBow_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFBow_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFBow_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFBow_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFBow_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFBow_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFHelmet_2": {
    "chest": true
  },
  "Blueprint_SFHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SFHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SFHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SFHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Shrine_Lantern": {
    "chest": true
  },
  "Blueprint_SingleShotRifle_2": {
    "chest": true
  },
  "Blueprint_SingleShotRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SingleShotRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SingleShotRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SingleShotRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SingleShotRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SingleShotRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SingleShotRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SingleShotRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SingleShotRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyAssaultRifle_2": {
    "chest": true
  },
  "Blueprint_SkyAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyAssaultRifle_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyAssaultRifle_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyAssaultRifle_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBeamSword_2": {
    "chest": true
  },
  "Blueprint_SkyBeamSword_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBeamSword_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBeamSword_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBeamSword_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBeamSword_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBeamSword_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBeamSword_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBeamSword_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBeamSword_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBow_2": {
    "chest": true
  },
  "Blueprint_SkyBow_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBow_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBow_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBow_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBow_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBow_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyBow_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyBow_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyBow_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyGrenadeLauncher_2": {
    "chest": true
  },
  "Blueprint_SkyGrenadeLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyGrenadeLauncher_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyGrenadeLauncher_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyGrenadeLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyGrenadeLauncher_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyGrenadeLauncher_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyGrenadeLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyGrenadeLauncher_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyGrenadeLauncher_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyShotgun_2": {
    "chest": true
  },
  "Blueprint_SkyShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkyShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkyShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkyShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkySubmachineGun_2": {
    "chest": true
  },
  "Blueprint_SkySubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkySubmachineGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkySubmachineGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkySubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkySubmachineGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkySubmachineGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SkySubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SkySubmachineGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SkySubmachineGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Spear_ForestBoss_5": {
    "merchant": true
  },
  "Blueprint_Spear_ForestBoss2_5": {
    "merchant": true
  },
  "Blueprint_StealArmor_2": {
    "chest": true
  },
  "Blueprint_StealArmor_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmor_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmor_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmor_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmor_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmor_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmor_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmor_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmor_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorCold_2": {
    "chest": true
  },
  "Blueprint_StealArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorCold_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorCold_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorCold_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorCold_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorCold_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorCold_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorHeat_2": {
    "chest": true
  },
  "Blueprint_StealArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorHeat_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorHeat_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealArmorHeat_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealHelmet_2": {
    "chest": true
  },
  "Blueprint_StealHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealHelmet_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealHelmet_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealHelmet_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealHelmet_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_StealHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_StealHelmet_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_StealHelmet_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SubmachineGun_2": {
    "chest": true
  },
  "Blueprint_SubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SubmachineGun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SubmachineGun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SubmachineGun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SubmachineGun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_SubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_SubmachineGun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_SubmachineGun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Sword_2": {
    "chest": true
  },
  "Blueprint_Sword_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Sword_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Sword_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Sword_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Sword_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Sword_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Sword_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_Sword_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_Sword_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WallTorch02": {
    "chest": true
  },
  "Blueprint_WeakerBow_2": {
    "chest": true
  },
  "Blueprint_WeakerBow_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WeakerBow_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WeakerBow_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WeakerBow_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WeakerBow_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WeakerBow_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WeakerBow_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WeakerBow_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WeakerBow_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WidePenetrateShotgun_2": {
    "chest": true
  },
  "Blueprint_WidePenetrateShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WidePenetrateShotgun_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WidePenetrateShotgun_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WidePenetrateShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WidePenetrateShotgun_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WidePenetrateShotgun_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_WidePenetrateShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_WidePenetrateShotgun_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_WidePenetrateShotgun_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_Wire_Fence": {
    "chest": true
  },
  "Blueprint_WoodenBarricade": {
    "chest": true
  },
  "Blueprint_YakushimaArmor001": {
    "chest": true
  },
  "Blueprint_YakushimaArmor001_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaArmor001_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaArmor001",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaArmor001_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaArmor001_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaArmor001_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaArmor001_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaArmor001_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaArmor001_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaArmor001_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaArmor001_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaArmor001_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade002": {
    "chest": true
  },
  "Blueprint_YakushimaBlade002_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade002_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade002",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade002_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade002_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade002_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade002_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade002_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade002_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade002_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade002_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade002_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade003": {
    "chest": true
  },
  "Blueprint_YakushimaBlade003_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade003_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade003",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade003_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade003_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade003_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade003_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade003_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade003_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade003_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade003_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade003_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade004": {
    "chest": true
  },
  "Blueprint_YakushimaBlade004_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade004_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade004",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade004_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade004_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade004_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade004_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade004_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade004_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaBlade004_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaBlade004_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaBlade004_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaGun001": {
    "chest": true
  },
  "Blueprint_YakushimaGun001_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaGun001_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaGun001",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaGun001_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaGun001_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaGun001_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaGun001_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaGun001_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaGun001_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaGun001_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaGun001_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaGun001_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip001": {
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip001_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip001_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip001",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip001_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip001_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip001_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip001_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip001_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip001_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip001_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip001_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip001_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip002": {
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip002_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip002_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip002",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip002_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip002_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip002_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip002_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip002_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip002_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip002_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip002_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip002_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip003": {
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip003_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip003_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip003",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip003_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip003_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip003_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip003_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip003_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip003_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip003_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip003_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip003_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip004": {
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip004_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip004_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip004",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip004_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip004_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip004_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip004_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip004_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip004_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaHeadEquip004_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaHeadEquip004_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaHeadEquip004_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaLantern001": {
    "chest": true
  },
  "Blueprint_YakushimaLantern001_2": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaLantern001_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaLantern001",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaLantern001_3": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaLantern001_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaLantern001_2",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaLantern001_4": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaLantern001_4",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaLantern001_3",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Blueprint_YakushimaLantern001_5": {
    "recipes": [
      {
        "sourceRowId": "Blueprint_YakushimaLantern001_5",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Blueprint_YakushimaLantern001_4",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "Bone": {
    "merchant": true,
    "chest": true
  },
  "Bow_Triple": {
    "recipes": [
      {
        "sourceRowId": "Bow_Triple",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 50
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 12
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "BowGun": {
    "recipes": [
      {
        "sourceRowId": "BowGun",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 50
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 40
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "BronzeSword": {
    "recipes": [
      {
        "sourceRowId": "BronzeSword",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 15
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Cake": {
    "recipes": [
      {
        "sourceRowId": "Cake",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 5
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 8
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 7
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 8
          },
          {
            "sourceInternalId": "Honey",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Cake02": {
    "recipes": [
      {
        "sourceRowId": "Cake02",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 5
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 5
          },
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 3
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 8
          },
          {
            "sourceInternalId": "Honey",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Cake03": {
    "recipes": [
      {
        "sourceRowId": "Cake03",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 8
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 8
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 7
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 8
          },
          {
            "sourceInternalId": "Honey",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "Cake04": {
    "recipes": [
      {
        "sourceRowId": "Cake04",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 12
          },
          {
            "sourceInternalId": "Sweet",
            "quantity": 8
          },
          {
            "sourceInternalId": "Potato",
            "quantity": 10
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 6
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "Cake05": {
    "recipes": [
      {
        "sourceRowId": "Cake05",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 20
          },
          {
            "sourceInternalId": "Sweet_Caramel",
            "quantity": 8
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 15
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 15
          },
          {
            "sourceInternalId": "Meat_GrassMammoth",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Carbonara": {
    "recipes": [
      {
        "sourceRowId": "Carbonara",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 2
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CarbonFiber": {
    "recipes": [
      {
        "sourceRowId": "CarbonFiber",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Coal",
            "quantity": 2
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CarbonFiber2",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Charcoal",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Carrot": {
    "merchant": true
  },
  "CarrotSeeds": {
    "merchant": true,
    "chest": true
  },
  "CaveMushroom": {
    "merchant": true,
    "chest": true
  },
  "Cement": {
    "recipes": [
      {
        "sourceRowId": "Cement",
        "resultCount": 10,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Charcoal": {
    "recipes": [
      {
        "sourceRowId": "Charcoal",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "ChargeLaserRifle": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifle",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 200
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 25
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "ChargeLaserRifle_2": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifle_2",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 250
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 31
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "ChargeLaserRifle_3": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifle_3",
        "resultCount": 1,
        "workAmount": 24000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 300
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 37
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 22
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "ChargeLaserRifle_4": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifle_4",
        "resultCount": 1,
        "workAmount": 48000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 350
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 43
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 26
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "ChargeLaserRifle_5": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifle_5",
        "resultCount": 1,
        "workAmount": 96000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 400
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 50
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "ChargeLaserRifleBullet": {
    "recipes": [
      {
        "sourceRowId": "ChargeLaserRifleBullet",
        "resultCount": 10,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "Cheeseburger_2": {
    "recipes": [
      {
        "sourceRowId": "Cheeseburger_2",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_CowPal",
            "quantity": 2
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "ChickenSaute": {
    "recipes": [
      {
        "sourceRowId": "ChickenSaute",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_ChickenPal",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Chowder": {
    "recipes": [
      {
        "sourceRowId": "Chowder",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_LazyCatfish",
            "quantity": 1
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 2
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "Chromium": {
    "chest": true,
    "gathering": true
  },
  "Cloth": {
    "recipes": [
      {
        "sourceRowId": "Cloth",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Wool",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Cloth2": {
    "recipes": [
      {
        "sourceRowId": "Cloth2",
        "resultCount": 1,
        "workAmount": 2500,
        "materials": [
          {
            "sourceInternalId": "Wool",
            "quantity": 10
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "ClothArmor": {
    "recipes": [
      {
        "sourceRowId": "ClothArmor",
        "resultCount": 1,
        "workAmount": 2000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 2
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "ClothArmorCold": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorCold",
        "resultCount": 1,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 3
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "ClothArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorCold_2",
        "resultCount": 1,
        "workAmount": 16000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 4
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "ClothArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorCold_3",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "ClothArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorCold_4",
        "resultCount": 1,
        "workAmount": 64000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 6
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "ClothArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorCold_5",
        "resultCount": 1,
        "workAmount": 128000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 7
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "ClothArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorHeat",
        "resultCount": 1,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 3
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "ClothArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorHeat_2",
        "resultCount": 1,
        "workAmount": 16000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 4
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "ClothArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorHeat_3",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "ClothArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorHeat_4",
        "resultCount": 1,
        "workAmount": 64000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 6
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "ClothArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "ClothArmorHeat_5",
        "resultCount": 1,
        "workAmount": 128000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 7
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Coal": {
    "chest": true,
    "gathering": true
  },
  "CompoundBow": {
    "recipes": [
      {
        "sourceRowId": "CompoundBow",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 40
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "CompoundBow_2": {
    "recipes": [
      {
        "sourceRowId": "CompoundBow_2",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "CompoundBow_3": {
    "recipes": [
      {
        "sourceRowId": "CompoundBow_3",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CompoundBow_4": {
    "recipes": [
      {
        "sourceRowId": "CompoundBow_4",
        "resultCount": 1,
        "workAmount": 960000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 70
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "CompoundBow_5": {
    "recipes": [
      {
        "sourceRowId": "CompoundBow_5",
        "resultCount": 1,
        "workAmount": 1920000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 80
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "Computer": {
    "recipes": [
      {
        "sourceRowId": "Computer",
        "resultCount": 1,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "MachineParts2",
            "quantity": 2
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 2
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CopperArmor": {
    "recipes": [
      {
        "sourceRowId": "CopperArmor",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "CopperArmorCold": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorCold",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 13
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 8
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "CopperArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorCold_2",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 16
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "CopperArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorCold_3",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 19
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "CopperArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorCold_4",
        "resultCount": 1,
        "workAmount": 640000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 22
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 14
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "CopperArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorCold_5",
        "resultCount": 1,
        "workAmount": 1280000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 26
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 16
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 16
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CopperArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorHeat",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 13
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 8
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "CopperArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorHeat_2",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 16
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "CopperArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorHeat_3",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 19
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "CopperArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorHeat_4",
        "resultCount": 1,
        "workAmount": 640000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 22
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 14
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "CopperArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "CopperArmorHeat_5",
        "resultCount": 1,
        "workAmount": 1280000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 26
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 16
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 16
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CopperHelmet": {
    "recipes": [
      {
        "sourceRowId": "CopperHelmet",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "CopperHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "CopperHelmet_2",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "CopperHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "CopperHelmet_3",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "CopperHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "CopperHelmet_4",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "CopperHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "CopperHelmet_5",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "CopperIngot": {
    "recipes": [
      {
        "sourceRowId": "CopperIngot",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "CopperOre",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "CopperOre": {
    "merchant": true,
    "chest": true,
    "gathering": true
  },
  "Corrosive_Solvent": {
    "recipes": [
      {
        "sourceRowId": "Corrosive_Solvent",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Venom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "CrudeOil": {
    "chest": true,
    "gathering": true
  },
  "Curry": {
    "recipes": [
      {
        "sourceRowId": "Curry",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "Meat_GrassMammoth",
            "quantity": 1
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Potato",
            "quantity": 2
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "DecalGun_1": {
    "recipes": [
      {
        "sourceRowId": "DecalGun_1",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DecalGun_2": {
    "recipes": [
      {
        "sourceRowId": "DecalGun_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DecalGun_3": {
    "recipes": [
      {
        "sourceRowId": "DecalGun_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DecalGun_4": {
    "recipes": [
      {
        "sourceRowId": "DecalGun_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DecalGun_5": {
    "recipes": [
      {
        "sourceRowId": "DecalGun_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DeerLocoMoco": {
    "recipes": [
      {
        "sourceRowId": "DeerLocoMoco",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_Deer",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "DeerStew": {
    "recipes": [
      {
        "sourceRowId": "DeerStew",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_Deer",
            "quantity": 2
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Diamond": {
    "merchant": true,
    "chest": true
  },
  "DogCoin": {
    "chest": true
  },
  "DoubleBarrelShotgun": {
    "recipes": [
      {
        "sourceRowId": "DoubleBarrelShotgun",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 7
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "DoubleBarrelShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "DoubleBarrelShotgun_2",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 8
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 31
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "DoubleBarrelShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "DoubleBarrelShotgun_3",
        "resultCount": 1,
        "workAmount": 640000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 37
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "DoubleBarrelShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "DoubleBarrelShotgun_4",
        "resultCount": 1,
        "workAmount": 1280000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 12
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 43
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "DoubleBarrelShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "DoubleBarrelShotgun_5",
        "resultCount": 1,
        "workAmount": 2560000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 14
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "DroneLauncher": {
    "recipes": [
      {
        "sourceRowId": "DroneLauncher",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 40
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "DroneLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "DroneLauncher_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 50
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "DroneLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "DroneLauncher_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 105
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 12
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "DroneLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "DroneLauncher_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 122
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 70
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 14
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "DroneLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "DroneLauncher_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 140
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 80
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 16
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Eaglestew": {
    "recipes": [
      {
        "sourceRowId": "Eaglestew",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_Eagle",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Eemerald": {
    "merchant": true,
    "chest": true
  },
  "Egg": {
    "merchant": true,
    "chest": true
  },
  "ElecBaton": {
    "recipes": [
      {
        "sourceRowId": "ElecBaton",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifle": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifle",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 50
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifle_2": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifle_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 62
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 75
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 12
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 140
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 87
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 14
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 160
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 100
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 16
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "ElectricArcAssaultRifleBullet": {
    "recipes": [
      {
        "sourceRowId": "ElectricArcAssaultRifleBullet",
        "resultCount": 20,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "ElectricOrgan": {
    "merchant": true,
    "chest": true
  },
  "Elixir_attack_01": {
    "recipes": [
      {
        "sourceRowId": "Elixir_attack_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Lotus_attack_01",
            "quantity": 4
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Elixir_attack_02": {
    "recipes": [
      {
        "sourceRowId": "Elixir_attack_02",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Lotus_attack_02",
            "quantity": 6
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Elixir_hp_01": {
    "recipes": [
      {
        "sourceRowId": "Elixir_hp_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Lotus_hp_01",
            "quantity": 4
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Elixir_hp_02": {
    "recipes": [
      {
        "sourceRowId": "Elixir_hp_02",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Lotus_hp_02",
            "quantity": 6
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Elixir_stamina_01": {
    "recipes": [
      {
        "sourceRowId": "Elixir_stamina_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Lotus_stamina_01",
            "quantity": 4
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Elixir_stamina_02": {
    "recipes": [
      {
        "sourceRowId": "Elixir_stamina_02",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Lotus_stamina_02",
            "quantity": 6
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Elixir_weight_01": {
    "recipes": [
      {
        "sourceRowId": "Elixir_weight_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Lotus_weight_01",
            "quantity": 4
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Elixir_weight_02": {
    "recipes": [
      {
        "sourceRowId": "Elixir_weight_02",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Lotus_weight_02",
            "quantity": 6
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Elixir_workspeed_01": {
    "recipes": [
      {
        "sourceRowId": "Elixir_workspeed_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Lotus_workspeed_01",
            "quantity": 4
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "Elixir_workspeed_02": {
    "recipes": [
      {
        "sourceRowId": "Elixir_workspeed_02",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Lotus_workspeed_02",
            "quantity": 6
          },
          {
            "sourceInternalId": "PredatorCrystal",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "EnergyLauncherBullet": {
    "recipes": [
      {
        "sourceRowId": "EnergyLauncherBullet",
        "resultCount": 10,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 1
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "EnergyRocketLauncher": {
    "recipes": [
      {
        "sourceRowId": "EnergyRocketLauncher",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 150
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 130
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 4
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "EnergyRocketLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "EnergyRocketLauncher_2",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 187
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 162
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "EnergyRocketLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "EnergyRocketLauncher_3",
        "resultCount": 1,
        "workAmount": 24000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 225
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 195
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "EnergyRocketLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "EnergyRocketLauncher_4",
        "resultCount": 1,
        "workAmount": 48000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 262
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 227
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "EnergyRocketLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "EnergyRocketLauncher_5",
        "resultCount": 1,
        "workAmount": 96000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 300
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 260
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 16
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "EnergyShotgun": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgun",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 155
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 130
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "EnergyShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgun_2",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 193
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 162
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "EnergyShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgun_3",
        "resultCount": 1,
        "workAmount": 24000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 232
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 195
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 22
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "EnergyShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgun_4",
        "resultCount": 1,
        "workAmount": 48000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 271
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 227
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 26
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "EnergyShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgun_5",
        "resultCount": 1,
        "workAmount": 96000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 310
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 260
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "EnergyShotgunBullet": {
    "recipes": [
      {
        "sourceRowId": "EnergyShotgunBullet",
        "resultCount": 10,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "ExpBoost_01": {
    "chest": true
  },
  "ExpBoost_02": {
    "chest": true
  },
  "ExpBoost_03": {
    "chest": true
  },
  "ExpBoost_04": {
    "recipes": [
      {
        "sourceRowId": "ExpBoost_04",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "AncientParts3",
            "quantity": 500
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 4
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "ExplosiveBullet": {
    "recipes": [
      {
        "sourceRowId": "ExplosiveBullet",
        "resultCount": 10,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 3
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Fiber": {
    "recipes": [
      {
        "sourceRowId": "Fiber",
        "resultCount": 2,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FireOrgan": {
    "merchant": true,
    "chest": true
  },
  "FishingBait_1": {
    "recipes": [
      {
        "sourceRowId": "FishingBait_1",
        "resultCount": 10,
        "workAmount": 1200,
        "materials": [
          {
            "sourceInternalId": "PalFluid",
            "quantity": 2
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 4
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "FishingBait_2": {
    "recipes": [
      {
        "sourceRowId": "FishingBait_2",
        "resultCount": 10,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "PalFluid",
            "quantity": 3
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 4
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "FishingBait_3": {
    "recipes": [
      {
        "sourceRowId": "FishingBait_3",
        "resultCount": 10,
        "workAmount": 35000,
        "materials": [
          {
            "sourceInternalId": "PalOil",
            "quantity": 4
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 4
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "FishingBait_3_A": {
    "recipes": [
      {
        "sourceRowId": "FishingBait_3_A",
        "resultCount": 3,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 5
          }
        ]
      }
    ],
    "chest": true
  },
  "FishingRod_01_1": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_01_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 3
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 8
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "FishingRod_01_2": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_01_2",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 6
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 16
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 16
          },
          {
            "sourceInternalId": "ManganeseOre",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "FishingRod_02_1": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_02_1",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 5
          },
          {
            "sourceInternalId": "Cement",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "FishingRod_02_2": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_02_2",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Cement",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "ManganeseOre",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "FishingRod_03_1": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_03_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 70
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "FishingRod_03_2": {
    "recipes": [
      {
        "sourceRowId": "FishingRod_03_2",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 140
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "FlameThrower": {
    "recipes": [
      {
        "sourceRowId": "FlameThrower",
        "resultCount": 1,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 13
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "FlameThrower_2": {
    "recipes": [
      {
        "sourceRowId": "FlameThrower_2",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 16
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 37
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "FlameThrower_3": {
    "recipes": [
      {
        "sourceRowId": "FlameThrower_3",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 19
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 45
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "FlameThrower_4": {
    "recipes": [
      {
        "sourceRowId": "FlameThrower_4",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 22
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 52
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "FlameThrower_5": {
    "recipes": [
      {
        "sourceRowId": "FlameThrower_5",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 26
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "FlamethrowerBullet": {
    "recipes": [
      {
        "sourceRowId": "FlamethrowerBullet",
        "resultCount": 10,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 2
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Flour": {
    "recipes": [
      {
        "sourceRowId": "Flour",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wheat",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "FragGrenade": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "FragGrenade_Dark": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Dark",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FragGrenade_Dragon": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Dragon",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FragGrenade_Elec": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Elec",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "FragGrenade_Fire": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Fire",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "FragGrenade_Ground": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Ground",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperOre",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FragGrenade_Ice": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Ice",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FragGrenade_Leaf": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Leaf",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FragGrenade_Super": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Super",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 3
          }
        ]
      }
    ],
    "chest": true
  },
  "FragGrenade_Water": {
    "recipes": [
      {
        "sourceRowId": "FragGrenade_Water",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FriedChicken": {
    "recipes": [
      {
        "sourceRowId": "FriedChicken",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_ChickenPal",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FriedEggs": {
    "recipes": [
      {
        "sourceRowId": "FriedEggs",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Egg",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FriedKelpie": {
    "recipes": [
      {
        "sourceRowId": "FriedKelpie",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_Kelpie",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Fruit__defense_01": {
    "recipes": [
      {
        "sourceRowId": "Fruit__defense_01",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Lotus_stamina_01",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_stamina_02",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_weight_02",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Fruit_attack_01": {
    "recipes": [
      {
        "sourceRowId": "Fruit_attack_01",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Lotus_attack_01",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_attack_02",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_workspeed_02",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Fruit_hp_01": {
    "recipes": [
      {
        "sourceRowId": "Fruit_hp_01",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Lotus_hp_01",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_hp_02",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_workspeed_01",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lotus_weight_01",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "FurArmor": {
    "recipes": [
      {
        "sourceRowId": "FurArmor",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "FurArmorCold": {
    "recipes": [
      {
        "sourceRowId": "FurArmorCold",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 4
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          }
        ]
      }
    ],
    "merchant": true
  },
  "FurArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "FurArmorCold_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 18
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "FurArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "FurArmorCold_3",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 22
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "FurArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "FurArmorCold_4",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 26
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 7
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 17
          }
        ]
      }
    ]
  },
  "FurArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "FurArmorCold_5",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 8
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FurArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "FurArmorHeat",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 4
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          }
        ]
      }
    ],
    "merchant": true
  },
  "FurArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "FurArmorHeat_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 18
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "FurArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "FurArmorHeat_3",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 22
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "FurArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "FurArmorHeat_4",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 26
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 7
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 17
          }
        ]
      }
    ]
  },
  "FurArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "FurArmorHeat_5",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 8
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FurHelmet": {
    "recipes": [
      {
        "sourceRowId": "FurHelmet",
        "resultCount": 1,
        "workAmount": 3000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FurHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "FurHelmet_2",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 12
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "FurHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "FurHelmet_3",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "FurHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "FurHelmet_4",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 17
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "FurHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "FurHelmet_5",
        "resultCount": 1,
        "workAmount": 96000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GasMask": {
    "recipes": [
      {
        "sourceRowId": "GasMask",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "UniqueMaterial_FlowerPrince",
            "quantity": 10
          },
          {
            "sourceInternalId": "WorldTreeOre",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "GatlingBullet": {
    "recipes": [
      {
        "sourceRowId": "GatlingBullet",
        "resultCount": 50,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "GatlingGun": {
    "recipes": [
      {
        "sourceRowId": "GatlingGun",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 70
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 70
          }
        ]
      }
    ]
  },
  "GatlingGun_2": {
    "recipes": [
      {
        "sourceRowId": "GatlingGun_2",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 187
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 87
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "GatlingGun_3": {
    "recipes": [
      {
        "sourceRowId": "GatlingGun_3",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 225
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 105
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 105
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "GatlingGun_4": {
    "recipes": [
      {
        "sourceRowId": "GatlingGun_4",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 262
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 122
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 122
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "GatlingGun_5": {
    "recipes": [
      {
        "sourceRowId": "GatlingGun_5",
        "resultCount": 1,
        "workAmount": 25600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 300
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 140
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 140
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "GenghisKhan": {
    "recipes": [
      {
        "sourceRowId": "GenghisKhan",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_SheepBall",
            "quantity": 1
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Glider_Old": {
    "recipes": [
      {
        "sourceRowId": "Glider_Old",
        "resultCount": 1,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "GrapplingGun": {
    "recipes": [
      {
        "sourceRowId": "GrapplingGun",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GrapplingGun2": {
    "recipes": [
      {
        "sourceRowId": "GrapplingGun2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "GrapplingGun3": {
    "recipes": [
      {
        "sourceRowId": "GrapplingGun3",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 80
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "GrapplingGun4": {
    "recipes": [
      {
        "sourceRowId": "GrapplingGun4",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "GrapplingGun5": {
    "recipes": [
      {
        "sourceRowId": "GrapplingGun5",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Gratin": {
    "recipes": [
      {
        "sourceRowId": "Gratin",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          },
          {
            "sourceInternalId": "Potato",
            "quantity": 2
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GrenadeBullet": {
    "recipes": [
      {
        "sourceRowId": "GrenadeBullet",
        "resultCount": 10,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "GrenadeLauncher": {
    "recipes": [
      {
        "sourceRowId": "GrenadeLauncher",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "GrenadeLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "GrenadeLauncher_2",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 93
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 75
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "GrenadeLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "GrenadeLauncher_3",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 112
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 90
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 22
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "GrenadeLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "GrenadeLauncher_4",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 131
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 105
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 26
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "GrenadeLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "GrenadeLauncher_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 120
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "GrilledSheepHerbs": {
    "recipes": [
      {
        "sourceRowId": "GrilledSheepHerbs",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_SheepBall",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "GrilledSwordCutlassFish": {
    "recipes": [
      {
        "sourceRowId": "GrilledSwordCutlassFish",
        "resultCount": 1,
        "workAmount": 16000,
        "materials": [
          {
            "sourceInternalId": "Meat_SwordCutlassFish",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GuidedMissileLauncher": {
    "recipes": [
      {
        "sourceRowId": "GuidedMissileLauncher",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "GuidedMissileLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "GuidedMissileLauncher_2",
        "resultCount": 1,
        "workAmount": 2400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 125
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 62
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 31
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "GuidedMissileLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "GuidedMissileLauncher_3",
        "resultCount": 1,
        "workAmount": 4800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 75
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 37
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "GuidedMissileLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "GuidedMissileLauncher_4",
        "resultCount": 1,
        "workAmount": 9600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 175
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 87
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 43
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "GuidedMissileLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "GuidedMissileLauncher_5",
        "resultCount": 1,
        "workAmount": 19200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 200
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 100
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "Gunpowder2": {
    "recipes": [
      {
        "sourceRowId": "Gunpowder2",
        "resultCount": 1,
        "workAmount": 3000,
        "materials": [
          {
            "sourceInternalId": "Charcoal",
            "quantity": 2
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Desert": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Desert",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Electric": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Electric",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Forest": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Forest",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Grass": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Grass",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Sakurajima": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Sakurajima",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Snow": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Snow",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "GYM_Head_Viking": {
    "recipes": [
      {
        "sourceRowId": "GYM_Head_Viking",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Gyoza": {
    "recipes": [
      {
        "sourceRowId": "Gyoza",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_Boar",
            "quantity": 1
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Hamburger_2": {
    "recipes": [
      {
        "sourceRowId": "Hamburger_2",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_CowPal",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "HandGun_Default": {
    "recipes": [
      {
        "sourceRowId": "HandGun_Default",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "HandgunBullet": {
    "recipes": [
      {
        "sourceRowId": "HandgunBullet",
        "resultCount": 20,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Head001": {
    "recipes": [
      {
        "sourceRowId": "Head001_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Head002": {
    "recipes": [
      {
        "sourceRowId": "Head002_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "Head003": {
    "recipes": [
      {
        "sourceRowId": "Head003_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Head004": {
    "recipes": [
      {
        "sourceRowId": "Head004_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Head005": {
    "recipes": [
      {
        "sourceRowId": "Head005_1",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Head006": {
    "recipes": [
      {
        "sourceRowId": "Head006_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Wool",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Head007": {
    "recipes": [
      {
        "sourceRowId": "Head007_1",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Head008": {
    "recipes": [
      {
        "sourceRowId": "Head008_1",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Head009": {
    "recipes": [
      {
        "sourceRowId": "Head009_1",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Head010": {
    "recipes": [
      {
        "sourceRowId": "Head010_1",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Head011": {
    "recipes": [
      {
        "sourceRowId": "Head011_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Head012": {
    "recipes": [
      {
        "sourceRowId": "Head012_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Head013": {
    "recipes": [
      {
        "sourceRowId": "Head013_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_ColorfulBird",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Head014": {
    "recipes": [
      {
        "sourceRowId": "Head014_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_ColorfulBird",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Head015": {
    "recipes": [
      {
        "sourceRowId": "Head015_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_PlantSlime",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Head016": {
    "recipes": [
      {
        "sourceRowId": "Head016_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_CaptainPenguin",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Head017": {
    "recipes": [
      {
        "sourceRowId": "Head017_1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_CatMage",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip001_purple": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip001_purple",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip023": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip023",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip024": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip024",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip025": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip025",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_LizardMan",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip026": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip026",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_NegativeOctopus",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip027": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip027",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip028": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip028",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_PinkRabbit",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip029": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip029",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip030": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip030",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip031": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip031",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_MopBaby",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip032": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip032",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_RaijinDaughter",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HeadEquip033": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip033",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "HeadEquip041": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip041",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip044": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip044",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip045": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip045",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "HeadEquip046": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip046",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip048": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip048",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip049": {
    "recipes": [
      {
        "sourceRowId": "HeadEquip049",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "HeadEquip050": {
    "merchant": true
  },
  "HeadEquip051": {
    "merchant": true
  },
  "HeadEquip052": {
    "merchant": true
  },
  "HeadEquip053": {
    "merchant": true
  },
  "HeadEquip054": {
    "merchant": true
  },
  "HeadEquip055": {
    "merchant": true
  },
  "HeadEquip056": {
    "merchant": true
  },
  "HeadEquip057": {
    "merchant": true
  },
  "HeadEquip058": {
    "merchant": true
  },
  "HeadEquip059": {
    "merchant": true
  },
  "HeadEquip060": {
    "merchant": true
  },
  "HeadEquip061": {
    "merchant": true
  },
  "HeadEquip062": {
    "merchant": true
  },
  "Herbs": {
    "recipes": [
      {
        "sourceRowId": "Herbs",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Berries",
            "quantity": 5
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "HighGrade_Processed_Wood": {
    "recipes": [
      {
        "sourceRowId": "HighGrade_Processed_Wood",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Homeward": {
    "recipes": [
      {
        "sourceRowId": "Homeward",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalItem_RaijinDaughter",
            "quantity": 1
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "HomingSphereLauncher": {
    "recipes": [
      {
        "sourceRowId": "HomingSphereLauncher",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Honey": {
    "chest": true
  },
  "Horn": {
    "merchant": true,
    "chest": true
  },
  "HotDog_2": {
    "recipes": [
      {
        "sourceRowId": "HotDog_2",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_Boar",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "IceOrgan": {
    "merchant": true,
    "chest": true
  },
  "InkBullet": {
    "recipes": [
      {
        "sourceRowId": "InkBullet",
        "resultCount": 10,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "PalFluid",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "IronArmor": {
    "recipes": [
      {
        "sourceRowId": "IronArmor",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "IronArmorCold": {
    "recipes": [
      {
        "sourceRowId": "IronArmorCold",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "IronArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "IronArmorCold_2",
        "resultCount": 1,
        "workAmount": 280000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "IronArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "IronArmorCold_3",
        "resultCount": 1,
        "workAmount": 560000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "IronArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "IronArmorCold_4",
        "resultCount": 1,
        "workAmount": 1120000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 4
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "IronArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "IronArmorCold_5",
        "resultCount": 1,
        "workAmount": 2240000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "IronArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "IronArmorHeat",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "IronArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "IronArmorHeat_2",
        "resultCount": 1,
        "workAmount": 280000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "IronArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "IronArmorHeat_3",
        "resultCount": 1,
        "workAmount": 560000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "IronArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "IronArmorHeat_4",
        "resultCount": 1,
        "workAmount": 1120000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 4
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 21
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "IronArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "IronArmorHeat_5",
        "resultCount": 1,
        "workAmount": 2240000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 24
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "IronHelmet": {
    "recipes": [
      {
        "sourceRowId": "IronHelmet",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "IronHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "IronHelmet_2",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "IronHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "IronHelmet_3",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 22
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "IronHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "IronHelmet_4",
        "resultCount": 1,
        "workAmount": 640000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 26
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "IronHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "IronHelmet_5",
        "resultCount": 1,
        "workAmount": 1280000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "IronIngot": {
    "recipes": [
      {
        "sourceRowId": "IronIngot",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "CopperOre",
            "quantity": 2
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "JamBun": {
    "recipes": [
      {
        "sourceRowId": "JamBun",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "JellyfishFairy_jelly": {
    "recipes": [
      {
        "sourceRowId": "JellyfishFairy_jelly",
        "resultCount": 1,
        "workAmount": 16000,
        "materials": [
          {
            "sourceInternalId": "Meat_JellyfishFairy",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "JellyfishGhost_jelly": {
    "recipes": [
      {
        "sourceRowId": "JellyfishGhost_jelly",
        "resultCount": 1,
        "workAmount": 16000,
        "materials": [
          {
            "sourceInternalId": "Meat_JellyfishGhost",
            "quantity": 2
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Katana": {
    "recipes": [
      {
        "sourceRowId": "Katana",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Katana_2": {
    "recipes": [
      {
        "sourceRowId": "Katana_2",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Katana_3": {
    "recipes": [
      {
        "sourceRowId": "Katana_3",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 3
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Katana_4": {
    "recipes": [
      {
        "sourceRowId": "Katana_4",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 4
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "Katana_5": {
    "recipes": [
      {
        "sourceRowId": "Katana_5",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 5
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Lantern": {
    "recipes": [
      {
        "sourceRowId": "Lantern",
        "resultCount": 1,
        "workAmount": 3000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Lantern_High": {
    "recipes": [
      {
        "sourceRowId": "Lantern_High",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "LaserBullet": {
    "recipes": [
      {
        "sourceRowId": "LaserBullet",
        "resultCount": 20,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "LaserGatlingBullet": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingBullet",
        "resultCount": 50,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "LaserGatlingGun": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingGun",
        "resultCount": 1,
        "workAmount": 1500000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 110
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 100
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "LaserGatlingGun_2": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingGun_2",
        "resultCount": 1,
        "workAmount": 6000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 137
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 125
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 12
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "LaserGatlingGun_3": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingGun_3",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 165
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 150
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 15
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "LaserGatlingGun_4": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingGun_4",
        "resultCount": 1,
        "workAmount": 24000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 192
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 175
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 17
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "LaserGatlingGun_5": {
    "recipes": [
      {
        "sourceRowId": "LaserGatlingGun_5",
        "resultCount": 1,
        "workAmount": 48000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 220
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 200
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 20
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "LaserMiningTool": {
    "recipes": [
      {
        "sourceRowId": "LaserMiningTool",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 50
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 30
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "LaserRifle": {
    "recipes": [
      {
        "sourceRowId": "LaserRifle",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 5
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "LaserRifle_2": {
    "recipes": [
      {
        "sourceRowId": "LaserRifle_2",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 50
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 6
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "LaserRifle_3": {
    "recipes": [
      {
        "sourceRowId": "LaserRifle_3",
        "resultCount": 1,
        "workAmount": 2400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 7
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "LaserRifle_4": {
    "recipes": [
      {
        "sourceRowId": "LaserRifle_4",
        "resultCount": 1,
        "workAmount": 4800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 70
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 8
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "LaserRifle_5": {
    "recipes": [
      {
        "sourceRowId": "LaserRifle_5",
        "resultCount": 1,
        "workAmount": 9600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 80
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 10
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Launcher_Default": {
    "recipes": [
      {
        "sourceRowId": "Launcher_Default",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Launcher_Meteor": {
    "recipes": [
      {
        "sourceRowId": "Launcher_Meteor",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 100
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Launcher_Meteor_5": {
    "recipes": [
      {
        "sourceRowId": "Launcher_Meteor_5",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 200
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Leather": {
    "merchant": true,
    "chest": true
  },
  "Lettuce": {
    "merchant": true
  },
  "LettuceSeeds": {
    "merchant": true,
    "chest": true
  },
  "Lotus_attack_01": {
    "chest": true
  },
  "Lotus_attack_02": {
    "chest": true
  },
  "Lotus_hp_01": {
    "chest": true
  },
  "Lotus_hp_02": {
    "chest": true
  },
  "Lotus_stamina_01": {
    "chest": true
  },
  "Lotus_stamina_02": {
    "chest": true
  },
  "Lotus_weight_01": {
    "chest": true
  },
  "Lotus_weight_02": {
    "chest": true
  },
  "Lotus_workspeed_01": {
    "chest": true
  },
  "Lotus_workspeed_02": {
    "chest": true
  },
  "LuxuryMedicines": {
    "recipes": [
      {
        "sourceRowId": "LuxuryMedicines",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "LvUP_01": {
    "merchant": true,
    "chest": true
  },
  "MachineParts": {
    "recipes": [
      {
        "sourceRowId": "MachineParts",
        "resultCount": 5,
        "workAmount": 1500,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "MachineParts2": {
    "recipes": [
      {
        "sourceRowId": "MachineParts2",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Quartz",
            "quantity": 2
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "MakeshiftAssaultRifle": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftAssaultRifle",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "MakeshiftAssaultRifle_2": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftAssaultRifle_2",
        "resultCount": 1,
        "workAmount": 280000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 25
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "MakeshiftAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 560000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 105
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 90
          }
        ]
      }
    ]
  },
  "MakeshiftAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 1120000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 122
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 35
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 105
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "MakeshiftAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 2240000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 140
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 40
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "MakeshiftHandgun": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftHandgun",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          }
        ]
      }
    ],
    "merchant": true
  },
  "MakeshiftHandgun_2": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftHandgun_2",
        "resultCount": 1,
        "workAmount": 160000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 12
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 37
          }
        ]
      }
    ]
  },
  "MakeshiftHandgun_3": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftHandgun_3",
        "resultCount": 1,
        "workAmount": 320000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "MakeshiftHandgun_4": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftHandgun_4",
        "resultCount": 1,
        "workAmount": 640000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 61
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 17
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 52
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "MakeshiftHandgun_5": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftHandgun_5",
        "resultCount": 1,
        "workAmount": 1280000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "MakeshiftShotgun": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftShotgun",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "MakeshiftShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftShotgun_2",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 18
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 62
          }
        ]
      }
    ]
  },
  "MakeshiftShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftShotgun_3",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 90
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 22
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "MakeshiftShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftShotgun_4",
        "resultCount": 1,
        "workAmount": 960000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 105
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 26
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "MakeshiftShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftShotgun_5",
        "resultCount": 1,
        "workAmount": 1920000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 100
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "MakeshiftSubmachineGun": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftSubmachineGun",
        "resultCount": 1,
        "workAmount": 45000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "MakeshiftSubmachineGun_2": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftSubmachineGun_2",
        "resultCount": 1,
        "workAmount": 180000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 12
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 37
          }
        ]
      }
    ]
  },
  "MakeshiftSubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftSubmachineGun_3",
        "resultCount": 1,
        "workAmount": 360000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "MakeshiftSubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftSubmachineGun_4",
        "resultCount": 1,
        "workAmount": 720000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 17
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 52
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "MakeshiftSubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "MakeshiftSubmachineGun_5",
        "resultCount": 1,
        "workAmount": 1440000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "ManganeseIngot": {
    "recipes": [
      {
        "sourceRowId": "ManganeseIngot",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "ManganeseOre",
            "quantity": 2
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "ManganeseOre": {
    "chest": true,
    "gathering": true
  },
  "MarinatedMushrooms": {
    "recipes": [
      {
        "sourceRowId": "MarinatedMushrooms",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Mushroom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Meat_BerryGoat": {
    "merchant": true,
    "chest": true
  },
  "Meat_Boar": {
    "merchant": true,
    "chest": true
  },
  "Meat_ChickenPal": {
    "merchant": true,
    "chest": true
  },
  "Meat_CowPal": {
    "merchant": true,
    "chest": true
  },
  "Meat_Deer": {
    "merchant": true,
    "chest": true
  },
  "Meat_Eagle": {
    "merchant": true,
    "chest": true
  },
  "Meat_GrassMammoth": {
    "merchant": true,
    "chest": true
  },
  "Meat_IceCrocodile": {
    "merchant": true,
    "chest": true
  },
  "Meat_IceDeer": {
    "merchant": true,
    "chest": true
  },
  "Meat_JellyfishFairy": {
    "merchant": true,
    "chest": true
  },
  "Meat_JellyfishGhost": {
    "merchant": true,
    "chest": true
  },
  "Meat_Kelpie": {
    "merchant": true,
    "chest": true
  },
  "Meat_LazyCatfish": {
    "merchant": true,
    "chest": true
  },
  "Meat_OctopusGirl": {
    "merchant": true,
    "chest": true
  },
  "Meat_SakuraSaurus": {
    "merchant": true,
    "chest": true
  },
  "Meat_SheepBall": {
    "merchant": true,
    "chest": true
  },
  "Meat_SwordCutlassFish": {
    "merchant": true
  },
  "MeatAndPotatoes": {
    "recipes": [
      {
        "sourceRowId": "MeatAndPotatoes",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "Meat_Eagle",
            "quantity": 1
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Potato",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "MeatCutterKnife": {
    "recipes": [
      {
        "sourceRowId": "MeatCutterKnife",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Medicines": {
    "recipes": [
      {
        "sourceRowId": "Medicines",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "MetalDetector": {
    "recipes": [
      {
        "sourceRowId": "MetalDetector",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 15
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "MeteorBullet": {
    "recipes": [
      {
        "sourceRowId": "MeteorBullet",
        "resultCount": 10,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true
  },
  "Milk": {
    "merchant": true,
    "chest": true
  },
  "Minestrone": {
    "recipes": [
      {
        "sourceRowId": "Minestrone",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Tomato",
            "quantity": 3
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Potato",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "MissileBullet": {
    "recipes": [
      {
        "sourceRowId": "MissileBullet",
        "resultCount": 10,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 1
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Money": {
    "recipes": [
      {
        "sourceRowId": "Money",
        "resultCount": 20000,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "MultiGuidedMissileLauncher": {
    "recipes": [
      {
        "sourceRowId": "MultiGuidedMissileLauncher",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 80
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "MultiGuidedMissileLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "MultiGuidedMissileLauncher_2",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 187
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 100
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 37
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "MultiGuidedMissileLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "MultiGuidedMissileLauncher_3",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 225
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 120
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 45
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "MultiGuidedMissileLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "MultiGuidedMissileLauncher_4",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 262
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 140
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 52
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "MultiGuidedMissileLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "MultiGuidedMissileLauncher_5",
        "resultCount": 1,
        "workAmount": 32000000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 300
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 160
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "Computer",
            "quantity": 16
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "Mushroom": {
    "merchant": true,
    "chest": true
  },
  "MushroomJuice": {
    "recipes": [
      {
        "sourceRowId": "MushroomJuice",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "PoisonMushroom",
            "quantity": 20
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 10
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "MushroomSoup": {
    "recipes": [
      {
        "sourceRowId": "MushroomSoup",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Mushroom",
            "quantity": 1
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Musket": {
    "recipes": [
      {
        "sourceRowId": "Musket",
        "resultCount": 1,
        "workAmount": 35000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 5
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true
  },
  "Musket_2": {
    "recipes": [
      {
        "sourceRowId": "Musket_2",
        "resultCount": 1,
        "workAmount": 140000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 31
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 6
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Musket_3": {
    "recipes": [
      {
        "sourceRowId": "Musket_3",
        "resultCount": 1,
        "workAmount": 280000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 7
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "Musket_4": {
    "recipes": [
      {
        "sourceRowId": "Musket_4",
        "resultCount": 1,
        "workAmount": 560000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 8
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Musket_5": {
    "recipes": [
      {
        "sourceRowId": "Musket_5",
        "resultCount": 1,
        "workAmount": 1120000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Narcotic": {
    "recipes": [
      {
        "sourceRowId": "Narcotic",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Poppy",
            "quantity": 5
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Octavia001_Armor": {
    "recipes": [
      {
        "sourceRowId": "Octavia001_Armor",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Octavia001_Armor_5": {
    "recipes": [
      {
        "sourceRowId": "Octavia001_Armor_05",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 270
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 85
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Octavia002_Armor": {
    "recipes": [
      {
        "sourceRowId": "Octavia002_Armor",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Octavia002_Armor_5": {
    "recipes": [
      {
        "sourceRowId": "Octavia002_Armor_05",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 270
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 202
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 80
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "OctaviaRevolver": {
    "recipes": [
      {
        "sourceRowId": "OctaviaRevolver",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 15
          },
          {
            "sourceInternalId": "Money",
            "quantity": 1
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "OctaviaRevolver_5": {
    "recipes": [
      {
        "sourceRowId": "OctaviaRevolver_5",
        "resultCount": 1,
        "workAmount": 2560000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 30
          },
          {
            "sourceInternalId": "Money",
            "quantity": 1
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "OctaviaShotgun": {
    "recipes": [
      {
        "sourceRowId": "OctaviaShotgun",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 65
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 32
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "OctaviaShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "OctaviaShotgun_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 160
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 130
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 64
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 80
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "OctopusGirl_Takoyaki": {
    "recipes": [
      {
        "sourceRowId": "OctopusGirl_Takoyaki",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Meat_OctopusGirl",
            "quantity": 2
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "OctopusGirl_Takoyaki2": {
    "recipes": [
      {
        "sourceRowId": "OctopusGirl_Takoyaki2",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_OctopusGirl",
            "quantity": 3
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 3
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "OldRevolver": {
    "recipes": [
      {
        "sourceRowId": "OldRevolver",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "OldRevolver_2": {
    "recipes": [
      {
        "sourceRowId": "OldRevolver_2",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "OldRevolver_3": {
    "recipes": [
      {
        "sourceRowId": "OldRevolver_3",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 90
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "OldRevolver_4": {
    "recipes": [
      {
        "sourceRowId": "OldRevolver_4",
        "resultCount": 1,
        "workAmount": 960000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 105
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "OldRevolver_5": {
    "recipes": [
      {
        "sourceRowId": "OldRevolver_5",
        "resultCount": 1,
        "workAmount": 1920000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Omelet": {
    "recipes": [
      {
        "sourceRowId": "Omelet",
        "resultCount": 1,
        "workAmount": 6000,
        "materials": [
          {
            "sourceInternalId": "Tomato",
            "quantity": 1
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true
  },
  "Onion": {
    "merchant": true
  },
  "OnionSeeds": {
    "merchant": true,
    "chest": true
  },
  "Opium": {
    "recipes": [
      {
        "sourceRowId": "Opium",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Poppy",
            "quantity": 3
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 1
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "Otomo_ATDark_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATDark_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 15
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATDragon_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATDragon_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 20
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATEarth_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATEarth_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATElectricity_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATElectricity_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATFire_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATFire_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATIce_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATIce_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATLeaf_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATLeaf_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 5
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_ATNormal_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATNormal_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_Attack_up1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_Attack_up1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ATWater_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ATWater_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Otomo_Defense_up1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_Defense_up1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_DFDark_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFDark_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 5
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFDragon_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFDragon_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFEarth_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFEarth_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFElectricity_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFElectricity_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFFire_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFFire_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFIce_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFIce_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFLeaf_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFLeaf_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFNormal_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFNormal_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_DFWater_ElementBoost_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_DFWater_ElementBoost_1",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Dark_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Dark_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Dragon_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Dragon_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Earth_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Earth_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Electricity_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Electricity_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Fire_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Fire_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Ice_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Ice_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Leaf_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Leaf_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalItem_PlantSlime",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Normal_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Normal_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cement",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_ElementBoost_Water_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_ElementBoost_Water_1",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Otomo_PalConfidence_Increase_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_PalConfidence_Increase_1",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 10
          },
          {
            "sourceInternalId": "Lava_Ancient",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Otomo_PalExp_Increase_1": {
    "recipes": [
      {
        "sourceRowId": "Otomo_PalExp_Increase_1",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PoisonMushroom",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "OverheatRifle": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifle",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 160
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 135
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "OverheatRifle_2": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifle_2",
        "resultCount": 1,
        "workAmount": 12000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 200
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 168
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 62
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "OverheatRifle_3": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifle_3",
        "resultCount": 1,
        "workAmount": 24000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 240
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 202
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 75
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "OverheatRifle_4": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifle_4",
        "resultCount": 1,
        "workAmount": 48000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 280
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 236
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 87
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "OverheatRifle_5": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifle_5",
        "resultCount": 1,
        "workAmount": 96000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 320
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 270
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 100
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "OverheatRifleBullet": {
    "recipes": [
      {
        "sourceRowId": "OverheatRifleBullet",
        "resultCount": 20,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 1
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "Pal_crystal_S": {
    "recipes": [
      {
        "sourceRowId": "CryStal_PalSphere",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Ancient_1",
        "resultCount": 30,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Ancient_1",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Ancient_2",
        "resultCount": 30,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Ancient_2",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Exotic",
        "resultCount": 15,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Exotic",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Giga",
        "resultCount": 2,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Giga",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Legend",
        "resultCount": 5,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Legend",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Master",
        "resultCount": 5,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Master",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Mega",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Mega",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Tera",
        "resultCount": 3,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Tera",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "CryStal_PalSphere_Ultimate",
        "resultCount": 10,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalSphere_Ultimate",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "Pal_crystal_S",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          }
        ]
      },
      {
        "sourceRowId": "Pal_crystal_S_2",
        "resultCount": 3,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 1
          }
        ]
      },
      {
        "sourceRowId": "Pal_crystal_S_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "CopperOre",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true,
    "gathering": true
  },
  "PalAwakening_Dark": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Dark",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Dark",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Dragon": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Dragon",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Dragon",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Electric": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Electric",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Electric",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Fire": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Fire",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Fire",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Grass": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Grass",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Grass",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Ground": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Ground",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Ground",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Ice": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Ice",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Ice",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Material_Dark": {
    "chest": true
  },
  "PalAwakening_Material_Dragon": {
    "chest": true
  },
  "PalAwakening_Material_Electric": {
    "chest": true
  },
  "PalAwakening_Material_Fire": {
    "chest": true
  },
  "PalAwakening_Material_Grass": {
    "chest": true
  },
  "PalAwakening_Material_Ground": {
    "chest": true
  },
  "PalAwakening_Material_Ice": {
    "chest": true
  },
  "PalAwakening_Material_Neutral": {
    "chest": true
  },
  "PalAwakening_Material_Water": {
    "chest": true
  },
  "PalAwakening_Neutral": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Neutral",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Neutral",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalAwakening_Water": {
    "recipes": [
      {
        "sourceRowId": "PalAwakening_Water",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "PalAwakening_Material_Water",
            "quantity": 50
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PalCrystal_Ex": {
    "chest": true
  },
  "PalDarkParts": {
    "chest": true
  },
  "PalDopingShot": {
    "recipes": [
      {
        "sourceRowId": "PalDopingShot",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "PalDopingShot_2": {
    "recipes": [
      {
        "sourceRowId": "PalDopingShot_2",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 120
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 200
          },
          {
            "sourceInternalId": "MachineParts2",
            "quantity": 100
          }
        ]
      }
    ]
  },
  "PalDopingShotBullet": {
    "recipes": [
      {
        "sourceRowId": "PalDopingShotBullet",
        "resultCount": 10,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true
  },
  "PalFluid": {
    "merchant": true,
    "chest": true
  },
  "PalGenderReverse": {
    "merchant": true,
    "chest": true
  },
  "PalHealingGrenade": {
    "recipes": [
      {
        "sourceRowId": "PalHealingGrenade",
        "resultCount": 1,
        "workAmount": 13000,
        "materials": [
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PalItem_CaptainPenguin": {
    "merchant": true
  },
  "PalItem_CatMage": {
    "merchant": true
  },
  "PalItem_ColorfulBird": {
    "merchant": true
  },
  "PalItem_LizardMan": {
    "merchant": true
  },
  "PalItem_MopBaby": {
    "merchant": true
  },
  "PalItem_NegativeOctopus": {
    "merchant": true
  },
  "PalItem_PinkRabbit": {
    "merchant": true
  },
  "PalItem_PlantSlime": {
    "merchant": true
  },
  "PalItem_RaijinDaughter": {
    "merchant": true
  },
  "PalItem_ToSell_01": {
    "merchant": true
  },
  "PalItem_ToSell_02": {
    "merchant": true
  },
  "PalItem_ToSell_03": {
    "merchant": true
  },
  "PalItem_ToSell_04": {
    "merchant": true
  },
  "PalItem_ToSell_05": {
    "merchant": true
  },
  "PalOil": {
    "merchant": true,
    "chest": true
  },
  "PalPassiveSkillChange_AutoHPRegeneRate_Passive": {
    "merchant": true
  },
  "PalPassiveSkillChange_Consumable_CraftSpeed_up3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_Deffence_up3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_MoveSpeed_up_3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_MutationPal_Babysitter": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_MutationPal_ExplosionResist": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_MutationPal_Immortal": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_MutationPal_Mutant": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_PAL_ALLAttack_up3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_PAL_FullStomach_Down_3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_PAL_Sanity_Down_3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_RideJumpCount_Increase2": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_Stamina_Up_3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_SwimSpeed_up_3": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_Vampire": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_ATK": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_ATK_DEF": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_CraftSpeed": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_DEF": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_FullStomach": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_MoveSpeed": {
    "chest": true
  },
  "PalPassiveSkillChange_Consumable_WorldTree_Sanity": {
    "chest": true
  },
  "PalPassiveSkillChange_CoolTimeReduction_Up_1": {
    "merchant": true
  },
  "PalPassiveSkillChange_CraftSpeed_up2": {
    "merchant": true
  },
  "PalPassiveSkillChange_Deffence_up2": {
    "merchant": true
  },
  "PalPassiveSkillChange_MoveSpeed_up_2": {
    "merchant": true
  },
  "PalPassiveSkillChange_Noukin": {
    "merchant": true
  },
  "PalPassiveSkillChange_PlayerSP_DecreaseRate_Passive": {
    "merchant": true
  },
  "PalPassiveSkillChange_ReloadSpeedUp_Passive": {
    "merchant": true
  },
  "PalPassiveSkillChange_SalePrice_Up_1": {
    "merchant": true
  },
  "PalPassiveSkillChange_Stamina_Up_1": {
    "merchant": true
  },
  "PalPassiveSkillChange_SwimSpeed_up_2": {
    "merchant": true
  },
  "PalPassiveSkillChange_TrainerATK_UP_1": {
    "merchant": true
  },
  "PalPassiveSkillChange_TrainerDEF_UP_1": {
    "merchant": true
  },
  "PalPassiveSkillChange_TrainerWorkSpeed_UP_1": {
    "merchant": true
  },
  "PalRevive": {
    "recipes": [
      {
        "sourceRowId": "PalRevive",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 30
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Sweet",
            "quantity": 10
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 20
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere": {
    "recipes": [
      {
        "sourceRowId": "PalSphere",
        "resultCount": 1,
        "workAmount": 300,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "PalSphere_Ancient_1": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Ancient_1",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Ancient_2": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Ancient_2",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 6
          },
          {
            "sourceInternalId": "Wood_WorldTree",
            "quantity": 3
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Exotic": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Exotic",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 1
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 10
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Giga": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Giga",
        "resultCount": 1,
        "workAmount": 2500,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 2
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 5
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "PalSphere_Legend": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Legend",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 3
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 20
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Master": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Master",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Mega": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Mega",
        "resultCount": 1,
        "workAmount": 1500,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 1
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 3
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "PalSphere_Tera": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Tera",
        "resultCount": 1,
        "workAmount": 6000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 3
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 8
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 8
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSphere_Ultimate": {
    "recipes": [
      {
        "sourceRowId": "PalSphere_Ultimate",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 10
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_DarkMechaDragon": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_DarkMechaDragon",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_DarkMechaDragon_Parts",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_DarkMechaDragon_2": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_DarkMechaDragon_2",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_DarkMechaDragon_Parts_2",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PalSummon_DarkMechaDragon_Parts": {
    "chest": true
  },
  "PalSummon_KingBahamut_Dragon": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_KingBahamut_Dragon",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_KingBahamut_Dragon_Parts",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_KingBahamut_Dragon_2": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_KingBahamut_Dragon_2",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_KingBahamut_Dragon_Parts_2",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PalSummon_KingBahamut_Dragon_Parts": {
    "chest": true
  },
  "PalSummon_LegendDeer": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_LegendDeer",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_LegendDeer_Parts",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_LegendDeer_2": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_LegendDeer_2",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_LegendDeer_Parts_2",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PalSummon_LegendDeer_Parts": {
    "chest": true
  },
  "PalSummon_NightLady": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_NightLady",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_NightLady_Parts",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_NightLady_Dark": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_NightLady_Dark",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_NightLady_Dark_Parts",
            "quantity": 4
          }
        ]
      }
    ],
    "chest": true
  },
  "PalSummon_NightLady_Dark_2": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_NightLady_Dark_2",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "PalSummon_NightLady_Dark_Parts_2",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PalSummon_NightLady_Dark_Parts": {
    "chest": true
  },
  "PalSummon_NightLady_Parts": {
    "chest": true
  },
  "PalSummon_YakushimaBoss002": {
    "recipes": [
      {
        "sourceRowId": "PalSummon_YakushimaBoss002",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 100
          }
        ]
      }
    ]
  },
  "PalUpgradeStone": {
    "recipes": [
      {
        "sourceRowId": "PalUpgradeStone2_1",
        "resultCount": 2,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone2",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "PalUpgradeStone2": {
    "recipes": [
      {
        "sourceRowId": "PalUpgradeStone1_2",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone",
            "quantity": 2
          }
        ]
      },
      {
        "sourceRowId": "PalUpgradeStone3_2",
        "resultCount": 2,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone3",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "PalUpgradeStone3": {
    "recipes": [
      {
        "sourceRowId": "PalUpgradeStone2_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone2",
            "quantity": 2
          }
        ]
      },
      {
        "sourceRowId": "PalUpgradeStone3_4",
        "resultCount": 2,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone4",
            "quantity": 1
          }
        ]
      }
    ],
    "chest": true
  },
  "PalUpgradeStone4": {
    "recipes": [
      {
        "sourceRowId": "PalUpgradeStone4_3",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "PalUpgradeStone3",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "Pan": {
    "recipes": [
      {
        "sourceRowId": "Pan",
        "resultCount": 1,
        "workAmount": 2000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Pancake": {
    "recipes": [
      {
        "sourceRowId": "Pancake",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Pickaxe_Steal": {
    "recipes": [
      {
        "sourceRowId": "Pickaxe_Steal",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 100
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Pickaxe_Tier_00": {
    "recipes": [
      {
        "sourceRowId": "Pickaxe_Tier_00",
        "resultCount": 1,
        "workAmount": 500,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Pickaxe_Tier_01": {
    "recipes": [
      {
        "sourceRowId": "Pickaxe_Tier_01",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 15
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Pickaxe_Tier_02": {
    "recipes": [
      {
        "sourceRowId": "Pickaxe_Tier_02",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Stone",
            "quantity": 30
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 4
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Pizza": {
    "recipes": [
      {
        "sourceRowId": "Pizza",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 2
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Plastic": {
    "recipes": [
      {
        "sourceRowId": "Plastic",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 2
          },
          {
            "sourceInternalId": "CopperOre",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmor": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmor",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmor_2": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmor_2",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "PlasticArmor_3": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmor_3",
        "resultCount": 1,
        "workAmount": 2400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PlasticArmor_4": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmor_4",
        "resultCount": 1,
        "workAmount": 4800000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmor_5": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmor_5",
        "resultCount": 1,
        "workAmount": 9600000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "PlasticArmorCold": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorCold",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "PlasticArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorCold_2",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "PlasticArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorCold_3",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 7
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PlasticArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorCold_4",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 8
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorCold_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "PlasticArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorHeat",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "PlasticArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorHeat_2",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "PlasticArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorHeat_3",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 7
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PlasticArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorHeat_4",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 8
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorHeat_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "PlasticArmorWeight": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorWeight",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "PlasticArmorWeight_2": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorWeight_2",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 37
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "PlasticArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorWeight_3",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 45
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 7
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PlasticArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorWeight_4",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 52
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 8
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 14
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "PlasticArmorWeight_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 16
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "PlasticHelmet": {
    "recipes": [
      {
        "sourceRowId": "PlasticHelmet",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 20
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "PlasticHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "PlasticHelmet_2",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 25
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 31
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "PlasticHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "PlasticHelmet_3",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "PlasticHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "PlasticHelmet_4",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 35
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "PlasticHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "PlasticHelmet_5",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "Player_Outfit_Kigurumi001": {
    "recipes": [
      {
        "sourceRowId": "Player_Outfit_Kigurumi001",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "PoisonMushroom": {
    "merchant": true
  },
  "Polymer": {
    "recipes": [
      {
        "sourceRowId": "Polymer",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalOil",
            "quantity": 2
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Poppy": {
    "merchant": true
  },
  "Potato": {
    "merchant": true
  },
  "PotatoChips": {
    "recipes": [
      {
        "sourceRowId": "PotatoChips",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Potato",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "PotatoSeeds": {
    "merchant": true,
    "chest": true
  },
  "Potion": {
    "recipes": [
      {
        "sourceRowId": "Potion",
        "resultCount": 1,
        "workAmount": 7500,
        "materials": [
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 5
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 5
          },
          {
            "sourceInternalId": "Sweet",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Potion_Extreme": {
    "recipes": [
      {
        "sourceRowId": "Potion_Extreme",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 15
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Sweet",
            "quantity": 7
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "Potion_High": {
    "recipes": [
      {
        "sourceRowId": "Potion_High",
        "resultCount": 1,
        "workAmount": 25000,
        "materials": [
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 10
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 5
          },
          {
            "sourceInternalId": "Sweet",
            "quantity": 5
          },
          {
            "sourceInternalId": "Sulfur",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Potion_Low": {
    "recipes": [
      {
        "sourceRowId": "Potion_Low",
        "resultCount": 1,
        "workAmount": 2500,
        "materials": [
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 3
          },
          {
            "sourceInternalId": "Berries",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Processed_Wood": {
    "recipes": [
      {
        "sourceRowId": "Processed_Wood",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 5
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "PumpActionShotgun": {
    "recipes": [
      {
        "sourceRowId": "PumpActionShotgun",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Quartz": {
    "chest": true,
    "gathering": true
  },
  "Quiche": {
    "recipes": [
      {
        "sourceRowId": "Quiche",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 2
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Egg",
            "quantity": 2
          },
          {
            "sourceInternalId": "Milk",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "RainbowCrystal": {
    "chest": true,
    "gathering": true
  },
  "Rankup_1": {
    "merchant": true,
    "chest": true
  },
  "Rankup_2": {
    "merchant": true,
    "chest": true
  },
  "Rankup_3": {
    "merchant": true,
    "chest": true
  },
  "Rankup_4": {
    "merchant": true,
    "chest": true
  },
  "Rankup_Arbitrary": {
    "merchant": true,
    "chest": true
  },
  "ReinforcedArrow": {
    "recipes": [
      {
        "sourceRowId": "ReinforcedArrow",
        "resultCount": 10,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "RifleBullet": {
    "recipes": [
      {
        "sourceRowId": "RifleBullet",
        "resultCount": 10,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "RoughBullet": {
    "recipes": [
      {
        "sourceRowId": "RoughBullet",
        "resultCount": 20,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 1
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Ruby": {
    "merchant": true,
    "chest": true
  },
  "Salad": {
    "recipes": [
      {
        "sourceRowId": "Salad",
        "resultCount": 1,
        "workAmount": 4000,
        "materials": [
          {
            "sourceInternalId": "Lettuce",
            "quantity": 2
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Salvage_TreasureBoxKey02": {
    "recipes": [
      {
        "sourceRowId": "Salvage_TreasureBoxKey02",
        "resultCount": 10,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 1
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 1
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Sapphire": {
    "merchant": true,
    "chest": true
  },
  "Seafood_Salada": {
    "recipes": [
      {
        "sourceRowId": "Seafood_Salada",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_OctopusGirl",
            "quantity": 3
          },
          {
            "sourceInternalId": "Lettuce",
            "quantity": 4
          }
        ]
      }
    ],
    "merchant": true
  },
  "SemiAutoRifle": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoRifle",
        "resultCount": 1,
        "workAmount": 90000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SemiAutoRifle_2": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoRifle_2",
        "resultCount": 1,
        "workAmount": 360000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "SemiAutoRifle_3": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoRifle_3",
        "resultCount": 1,
        "workAmount": 720000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SemiAutoRifle_4": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoRifle_4",
        "resultCount": 1,
        "workAmount": 1440000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 61
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SemiAutoRifle_5": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoRifle_5",
        "resultCount": 1,
        "workAmount": 2880000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SemiAutoShotgun": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoShotgun",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SemiAutoShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoShotgun_2",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 25
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "SemiAutoShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoShotgun_3",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SemiAutoShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoShotgun_4",
        "resultCount": 1,
        "workAmount": 2400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 35
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SemiAutoShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "SemiAutoShotgun_5",
        "resultCount": 1,
        "workAmount": 4800000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 40
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFArmor": {
    "recipes": [
      {
        "sourceRowId": "SFArmor",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SFArmor_2": {
    "recipes": [
      {
        "sourceRowId": "SFArmor_2",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 62
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFArmor_3": {
    "recipes": [
      {
        "sourceRowId": "SFArmor_3",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 75
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFArmor_4": {
    "recipes": [
      {
        "sourceRowId": "SFArmor_4",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 87
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFArmor_5": {
    "recipes": [
      {
        "sourceRowId": "SFArmor_5",
        "resultCount": 1,
        "workAmount": 32000000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SFArmorCold": {
    "recipes": [
      {
        "sourceRowId": "SFArmorCold",
        "resultCount": 1,
        "workAmount": 1100000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SFArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "SFArmorCold_2",
        "resultCount": 1,
        "workAmount": 4400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 62
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 12
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "SFArmorCold_3",
        "resultCount": 1,
        "workAmount": 8800000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 75
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "SFArmorCold_4",
        "resultCount": 1,
        "workAmount": 17600000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 87
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 17
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "SFArmorCold_5",
        "resultCount": 1,
        "workAmount": 35200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SFArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "SFArmorHeat",
        "resultCount": 1,
        "workAmount": 1100000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SFArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "SFArmorHeat_2",
        "resultCount": 1,
        "workAmount": 4400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 62
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 12
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 2
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "SFArmorHeat_3",
        "resultCount": 1,
        "workAmount": 8800000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 75
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "SFArmorHeat_4",
        "resultCount": 1,
        "workAmount": 17600000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 87
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 17
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "SFArmorHeat_5",
        "resultCount": 1,
        "workAmount": 35200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SFArmorWeight": {
    "recipes": [
      {
        "sourceRowId": "SFArmorWeight",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 100
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SFArmorWeight_2": {
    "recipes": [
      {
        "sourceRowId": "SFArmorWeight_2",
        "resultCount": 1,
        "workAmount": 4800000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 125
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 12
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFArmorWeight_3": {
    "recipes": [
      {
        "sourceRowId": "SFArmorWeight_3",
        "resultCount": 1,
        "workAmount": 9600000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFArmorWeight_4": {
    "recipes": [
      {
        "sourceRowId": "SFArmorWeight_4",
        "resultCount": 1,
        "workAmount": 19200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 175
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 35
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 17
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 17
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFArmorWeight_5": {
    "recipes": [
      {
        "sourceRowId": "SFArmorWeight_5",
        "resultCount": 1,
        "workAmount": 38400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 200
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SFArrow": {
    "recipes": [
      {
        "sourceRowId": "SFArrow",
        "resultCount": 10,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 2
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 5
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SFBow": {
    "recipes": [
      {
        "sourceRowId": "SFBow",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 40
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SFBow_2": {
    "recipes": [
      {
        "sourceRowId": "SFBow_2",
        "resultCount": 1,
        "workAmount": 4000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 31
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SFBow_3": {
    "recipes": [
      {
        "sourceRowId": "SFBow_3",
        "resultCount": 1,
        "workAmount": 8000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 60
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 37
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFBow_4": {
    "recipes": [
      {
        "sourceRowId": "SFBow_4",
        "resultCount": 1,
        "workAmount": 16000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 70
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 43
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFBow_5": {
    "recipes": [
      {
        "sourceRowId": "SFBow_5",
        "resultCount": 1,
        "workAmount": 32000000,
        "materials": [
          {
            "sourceInternalId": "Plastic",
            "quantity": 80
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "NightStone",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFHelmet": {
    "recipes": [
      {
        "sourceRowId": "SFHelmet",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 40
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SFHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "SFHelmet_2",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 50
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SFHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "SFHelmet_3",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 60
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 22
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SFHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "SFHelmet_4",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 70
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 26
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SFHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "SFHelmet_5",
        "resultCount": 1,
        "workAmount": 12800000,
        "materials": [
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 80
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "Shield_02": {
    "recipes": [
      {
        "sourceRowId": "Shield_02",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Shield_03": {
    "recipes": [
      {
        "sourceRowId": "Shield_03",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Shield_04": {
    "recipes": [
      {
        "sourceRowId": "Shield_04",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Shield_07": {
    "recipes": [
      {
        "sourceRowId": "Shield_07",
        "resultCount": 1,
        "workAmount": 10000000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 250
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Shield_SF": {
    "recipes": [
      {
        "sourceRowId": "Shield_SF",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 50
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Shield_Ultra": {
    "recipes": [
      {
        "sourceRowId": "Shield_Ultra",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 150
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 50
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "ShotgunBullet": {
    "recipes": [
      {
        "sourceRowId": "ShotgunBullet",
        "resultCount": 10,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 3
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SingleShotRifle": {
    "recipes": [
      {
        "sourceRowId": "SingleShotRifle",
        "resultCount": 1,
        "workAmount": 70000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 5
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SingleShotRifle_2": {
    "recipes": [
      {
        "sourceRowId": "SingleShotRifle_2",
        "resultCount": 1,
        "workAmount": 280000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 6
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "SingleShotRifle_3": {
    "recipes": [
      {
        "sourceRowId": "SingleShotRifle_3",
        "resultCount": 1,
        "workAmount": 560000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 7
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SingleShotRifle_4": {
    "recipes": [
      {
        "sourceRowId": "SingleShotRifle_4",
        "resultCount": 1,
        "workAmount": 1120000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 8
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SingleShotRifle_5": {
    "recipes": [
      {
        "sourceRowId": "SingleShotRifle_5",
        "resultCount": 1,
        "workAmount": 2240000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood_Fine",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SkillCard_AcidRain": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_AirBlade": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_AirCanon": {
    "chest": true
  },
  "SkillCard_Apocalypse": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_AquaJet": {
    "chest": true
  },
  "SkillCard_BeamSlicer": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_BlastCanon": {
    "chest": true
  },
  "SkillCard_BlizzardLance": {
    "chest": true
  },
  "SkillCard_BubbleShot": {
    "chest": true
  },
  "SkillCard_BubbleShower": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_ChargeCanon": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_Commet": {
    "chest": true
  },
  "SkillCard_CrossWind": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_DarkArrow": {
    "chest": true
  },
  "SkillCard_DarkCanon": {
    "chest": true
  },
  "SkillCard_DarkLaser": {
    "chest": true
  },
  "SkillCard_DarkLegion": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_DarkPulse": {
    "chest": true
  },
  "SkillCard_DarkWave": {
    "chest": true
  },
  "SkillCard_DiamondFall": {
    "chest": true
  },
  "SkillCard_DiversionLaser": {
    "chest": true
  },
  "SkillCard_DragonBreath": {
    "chest": true
  },
  "SkillCard_DragonCanon": {
    "chest": true
  },
  "SkillCard_DragonMeteor": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_DragonWave": {
    "chest": true
  },
  "SkillCard_ElecWave": {
    "chest": true
  },
  "SkillCard_Eruption": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_FireBall": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_FireBlast": {
    "chest": true
  },
  "SkillCard_FireSeed": {
    "chest": true
  },
  "SkillCard_FlameFunnel": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_Flamethrower": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_FlameWall": {
    "chest": true
  },
  "SkillCard_FlareArrow": {
    "chest": true
  },
  "SkillCard_FlareTornado": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_FrostBreath": {
    "chest": true
  },
  "SkillCard_GhostFlame": {
    "chest": true
  },
  "SkillCard_GrassTornado": {
    "chest": true
  },
  "SkillCard_HolyBlast": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_HydroPump": {
    "chest": true
  },
  "SkillCard_HydroSlicer": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_HyperBeam": {
    "chest": true
  },
  "SkillCard_IceAge": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_IceBlade": {
    "chest": true
  },
  "SkillCard_IceMissile": {
    "chest": true
  },
  "SkillCard_IceWall": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_IcicleLine": {
    "chest": true
  },
  "SkillCard_IciclePierce": {
    "merchant": true
  },
  "SkillCard_IcicleThrow": {
    "chest": true
  },
  "SkillCard_Inferno": {
    "chest": true
  },
  "SkillCard_LightningStrike": {
    "chest": true
  },
  "SkillCard_LineGeyser": {
    "chest": true
  },
  "SkillCard_LineThunder": {
    "chest": true
  },
  "SkillCard_LockonLaser": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_MudShot": {
    "chest": true
  },
  "SkillCard_PoisonShot": {
    "chest": true
  },
  "SkillCard_PowerBall": {
    "chest": true
  },
  "SkillCard_PowerShot": {
    "chest": true
  },
  "SkillCard_RangeThunder": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_ReflectiveShuriken": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_RipTide": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_RockBeat": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_RockLance": {
    "chest": true
  },
  "SkillCard_RootAttack": {
    "chest": true
  },
  "SkillCard_RootLance": {
    "chest": true
  },
  "SkillCard_SandTornado": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_SandTwister": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_SeaGush": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_SeedMachinegun": {
    "chest": true
  },
  "SkillCard_SeedMine": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_SelfDestruct": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_ShadowBall": {
    "chest": true
  },
  "SkillCard_SolarBeam": {
    "chest": true
  },
  "SkillCard_SpecialCutter": {
    "chest": true
  },
  "SkillCard_SpreadPulse": {
    "chest": true
  },
  "SkillCard_StoneShotgun": {
    "chest": true
  },
  "SkillCard_ThreeThunder": {
    "chest": true
  },
  "SkillCard_ThrowRock": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_ThunderBall": {
    "chest": true
  },
  "SkillCard_Thunderbolt": {
    "chest": true
  },
  "SkillCard_ThunderFunnel": {
    "chest": true
  },
  "SkillCard_ThunderRain": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_ThunderStorm": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_Tremor": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_TriSpark": {
    "chest": true
  },
  "SkillCard_WallSplash": {
    "chest": true
  },
  "SkillCard_WaterBall": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_WaterGun": {
    "chest": true
  },
  "SkillCard_WindBurst": {
    "merchant": true,
    "chest": true
  },
  "SkillCard_WindCutter": {
    "chest": true
  },
  "SkillUnlock_Alpaca": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Alpaca",
        "resultCount": 1,
        "workAmount": 6000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "Wool",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkillUnlock_AmaterasuWolf": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_AmaterasuWolf",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_AmaterasuWolf_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_AmaterasuWolf_Dark",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_BadCatgirl": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BadCatgirl",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 30
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 85
          }
        ]
      }
    ]
  },
  "SkillUnlock_BirdDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BirdDragon",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_BirdDragon_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BirdDragon_Ice",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 12
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 36
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlackCentaur": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlackCentaur",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 24
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 36
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 102
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlackGriffon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlackGriffon",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 50
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlackMetalDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlackMetalDragon",
        "resultCount": 1,
        "workAmount": 80000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 55
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlackPuppy": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlackPuppy",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlueDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlueDragon",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlueDragon_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlueDragon_Ice",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 36
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 12
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlueSkyDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlueSkyDragon",
        "resultCount": 1,
        "workAmount": 180000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 32
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 32
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 83
          }
        ]
      }
    ]
  },
  "SkillUnlock_BlueThunderHorse": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_BlueThunderHorse",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_Boar": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Boar",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkillUnlock_Carbunclo": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Carbunclo",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_ColorfulBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ColorfulBird",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SkillUnlock_CubeTurtle": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_CubeTurtle",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 32
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "SkillUnlock_CubeTurtle_Neutral": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_CubeTurtle_Neutral",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 38
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 24
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 16
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_DarkMechaDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_DarkMechaDragon",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 50
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          }
        ]
      }
    ]
  },
  "SkillUnlock_Deer": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Deer",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 5
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SkillUnlock_Deer_Ground": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Deer_Ground",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 6
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 24
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 12
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 18
          }
        ]
      }
    ]
  },
  "SkillUnlock_DomeArmorDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_DomeArmorDragon",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 24
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 46
          }
        ]
      }
    ]
  },
  "SkillUnlock_DreamDemon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_DreamDemon",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 5
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_Eagle": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Eagle",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_ElecPanda": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ElecPanda",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "SkillUnlock_FairyDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FairyDragon",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_FairyDragon_Water": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FairyDragon_Water",
        "resultCount": 1,
        "workAmount": 18000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 24
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_FeatherOstrich": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FeatherOstrich",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_FengyunDeeper": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FengyunDeeper",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_FengyunDeeper_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FengyunDeeper_Electric",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "SkillUnlock_FireKirin": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FireKirin",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_FireKirin_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FireKirin_Dark",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 36
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 24
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlameBuffalo": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlameBuffalo",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlowerDinosaur": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlowerDinosaur",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlowerDinosaur_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlowerDinosaur_Electric",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 18
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 36
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 12
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlowerRabbit": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlowerRabbit",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlyingManta": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlyingManta",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkillUnlock_FlyingManta_Thunder": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_FlyingManta_Thunder",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkillUnlock_GhostAnglerfish": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GhostAnglerfish",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_GhostAnglerfish_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GhostAnglerfish_Fire",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 12
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 12
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_GhostBeast": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GhostBeast",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_GhostDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GhostDragon",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 30
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "SkillUnlock_GhostDragon_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GhostDragon_Fire",
        "resultCount": 1,
        "workAmount": 72000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 48
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 36
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "SkillUnlock_GoldenHorse": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GoldenHorse",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassGolem": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassGolem",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassGolem_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassGolem_Dark",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 24
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassMammoth": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassMammoth",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 50
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 70
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 10
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 100
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassMammoth_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassMammoth_Ice",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 60
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 84
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 12
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 120
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 72
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassPanda": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassPanda",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_GrassPanda_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GrassPanda_Electric",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 48
          }
        ]
      }
    ]
  },
  "SkillUnlock_GuardianDog": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_GuardianDog",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_HadesBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_HadesBird",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_HadesBird_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_HadesBird_Electric",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_HawkBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_HawkBird",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_Hedgehog": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Hedgehog",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkillUnlock_Hedgehog_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Hedgehog_Ice",
        "resultCount": 1,
        "workAmount": 6000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 6
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkillUnlock_Horus": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Horus",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 10
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_Horus_Water": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Horus_Water",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceDeer": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceDeer",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceHorse": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceHorse",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 36
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 60
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 80
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceHorse_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceHorse_Dark",
        "resultCount": 1,
        "workAmount": 180000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 43
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 72
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 96
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceNarwhal": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceNarwhal",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceNarwhal_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceNarwhal_Fire",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceSeal": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceSeal",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 6
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_IceSeal_Ground": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_IceSeal_Ground",
        "resultCount": 1,
        "workAmount": 36000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 72
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 7
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 36
          }
        ]
      }
    ]
  },
  "SkillUnlock_JetDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_JetDragon",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 70
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 210
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingAlpaca": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingAlpaca",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Wool",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingAlpaca_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingAlpaca_Ice",
        "resultCount": 1,
        "workAmount": 18000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 24
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "Wool",
            "quantity": 36
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingBahamut": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingBahamut",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 36
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 48
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingBahamut_Dragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingBahamut_Dragon",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 43
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 43
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 60
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 57
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingSunfish": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingSunfish",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_KingSunfish_Thunder": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_KingSunfish_Thunder",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 12
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_Kirin": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Kirin",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "SkillUnlock_Kirin_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Kirin_Ice",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 12
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_Kitsunebi": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Kitsunebi",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkillUnlock_Kitsunebi_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Kitsunebi_Ice",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_LazyDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_LazyDragon",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 35
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 85
          }
        ]
      }
    ]
  },
  "SkillUnlock_LazyDragon_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_LazyDragon_Electric",
        "resultCount": 1,
        "workAmount": 240000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 42
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 102
          }
        ]
      }
    ]
  },
  "SkillUnlock_LeafMomonga": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_LeafMomonga",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 40
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_LegendDeer": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_LegendDeer",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 48
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 48
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          }
        ]
      }
    ]
  },
  "SkillUnlock_LotusDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_LotusDragon",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "SkillUnlock_Manticore": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Manticore",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_Manticore_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Manticore_Dark",
        "resultCount": 1,
        "workAmount": 36000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 36
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 36
          }
        ]
      }
    ]
  },
  "SkillUnlock_Monkey": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Monkey",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 5
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 15
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_Monkey_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Monkey_Fire",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 6
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 18
          },
          {
            "sourceInternalId": "Wood",
            "quantity": 18
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_MoonQueen": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_MoonQueen",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_MopKing": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_MopKing",
        "resultCount": 1,
        "workAmount": 5000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 8
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_MushroomDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_MushroomDragon",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_MushroomDragon_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_MushroomDragon_Dark",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "PoisonMushroom",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_NaughtyCat": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_NaughtyCat",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_NegativeOctopus": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_NegativeOctopus",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_NegativeOctopus_Neutral": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_NegativeOctopus_Neutral",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 4
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "SkillUnlock_NightBlueHorse": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_NightBlueHorse",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 15
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "SkillUnlock_NightBlueHorse_Neutral": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_NightBlueHorse_Neutral",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 18
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 24
          },
          {
            "sourceInternalId": "PalOil",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 65
          }
        ]
      }
    ]
  },
  "SkillUnlock_Penguin": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Penguin",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 20
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_Penguin_Electric": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Penguin_Electric",
        "resultCount": 1,
        "workAmount": 36000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 24
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 3
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_Plesiosaur": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Plesiosaur",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_PoseidonOrca": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_PoseidonOrca",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 48
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 48
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 80
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          }
        ]
      }
    ]
  },
  "SkillUnlock_PurpleSpider": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_PurpleSpider",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Venom",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_RaijinDaughter": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_RaijinDaughter",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 15
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_RaijinDaughter_Water": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_RaijinDaughter_Water",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_RedArmorBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_RedArmorBird",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 25
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_SaintCentaur": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SaintCentaur",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 24
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 36
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 102
          }
        ]
      }
    ]
  },
  "SkillUnlock_SakuraSaurus": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SakuraSaurus",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_SakuraSaurus_Water": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SakuraSaurus_Water",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 36
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_Serpent": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Serpent",
        "resultCount": 1,
        "workAmount": 8000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_Serpent_Ground": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Serpent_Ground",
        "resultCount": 1,
        "workAmount": 9600,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 6
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 6
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "SkillUnlock_SkyDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SkyDragon",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_SkyDragon_Grass": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SkyDragon_Grass",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_SnowTigerBeastman": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SnowTigerBeastman",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 140
          }
        ]
      }
    ]
  },
  "SkillUnlock_SumoDog": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_SumoDog",
        "resultCount": 1,
        "workAmount": 18000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 15
          },
          {
            "sourceInternalId": "Plastic",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_Suzaku": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Suzaku",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_Suzaku_Water": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Suzaku_Water",
        "resultCount": 1,
        "workAmount": 60000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 48
          }
        ]
      }
    ]
  },
  "SkillUnlock_ThiefBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ThiefBird",
        "resultCount": 1,
        "workAmount": 18000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_ThunderBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ThunderBird",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_ThunderBird_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ThunderBird_Ice",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 12
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_ThunderDog": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ThunderDog",
        "resultCount": 1,
        "workAmount": 20000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 40
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "SkillUnlock_Thunderdog_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Thunderdog_Ice",
        "resultCount": 1,
        "workAmount": 24000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 48
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_ThunderFluffyBird": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_ThunderFluffyBird",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_TropicalOstrich": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_TropicalOstrich",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_Umihebi": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Umihebi",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 48
          }
        ]
      }
    ]
  },
  "SkillUnlock_Umihebi_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Umihebi_Fire",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 43
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 72
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 28
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 28
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 57
          }
        ]
      }
    ]
  },
  "SkillUnlock_VolcanicMonster": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_VolcanicMonster",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_VolcanicMonster_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_VolcanicMonster_Ice",
        "resultCount": 1,
        "workAmount": 18000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 24
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 24
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 24
          }
        ]
      }
    ]
  },
  "SkillUnlock_VolcanoDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_VolcanoDragon",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 15
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_VolcanoDragon_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_VolcanoDragon_Ice",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 24
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 24
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 18
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_WeaselDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WeaselDragon",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 10
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SkillUnlock_WeaselDragon_Fire": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WeaselDragon_Fire",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth",
            "quantity": 10
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "SkillUnlock_WhiteAlienDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WhiteAlienDragon",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "MeteorDrop",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "SkillUnlock_WhiteDeer": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WhiteDeer",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 24
          },
          {
            "sourceInternalId": "Potion_High",
            "quantity": 5
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 80
          }
        ]
      }
    ]
  },
  "SkillUnlock_WhiteDeer_Dark": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WhiteDeer_Dark",
        "resultCount": 1,
        "workAmount": 180000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 43
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 28
          },
          {
            "sourceInternalId": "Potion_High",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 96
          }
        ]
      }
    ]
  },
  "SkillUnlock_WhiteShieldDragon": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WhiteShieldDragon",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 75
          }
        ]
      }
    ]
  },
  "SkillUnlock_WindChimes": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WindChimes",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 5
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SkillUnlock_WindChimes_Ice": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_WindChimes_Ice",
        "resultCount": 1,
        "workAmount": 12000,
        "materials": [
          {
            "sourceInternalId": "Cloth",
            "quantity": 6
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 3
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 12
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 12
          }
        ]
      }
    ]
  },
  "SkillUnlock_Yeti": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Yeti",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "IceOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "SkillUnlock_Yeti_Grass": {
    "recipes": [
      {
        "sourceRowId": "SkillUnlock_Yeti_Grass",
        "resultCount": 1,
        "workAmount": 48000,
        "materials": [
          {
            "sourceInternalId": "Leather",
            "quantity": 36
          },
          {
            "sourceInternalId": "Poppy",
            "quantity": 24
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 12
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 48
          }
        ]
      }
    ]
  },
  "SkyAssaultRifle": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifle",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkyAssaultRifle_2": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifle_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 125
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 62
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkyAssaultRifle_3": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifle_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 150
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 75
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkyAssaultRifle_4": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifle_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 175
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 87
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkyAssaultRifle_5": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifle_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 200
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 100
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkyAssaultRifleBullet": {
    "recipes": [
      {
        "sourceRowId": "SkyAssaultRifleBullet",
        "resultCount": 20,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 10
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SkyBeamSword": {
    "recipes": [
      {
        "sourceRowId": "SkyBeamSword",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 250
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SkyBeamSword_2": {
    "recipes": [
      {
        "sourceRowId": "SkyBeamSword_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 312
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 37
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkyBeamSword_3": {
    "recipes": [
      {
        "sourceRowId": "SkyBeamSword_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 375
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 45
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkyBeamSword_4": {
    "recipes": [
      {
        "sourceRowId": "SkyBeamSword_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 437
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 52
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkyBeamSword_5": {
    "recipes": [
      {
        "sourceRowId": "SkyBeamSword_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 500
          },
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 60
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkyBow": {
    "recipes": [
      {
        "sourceRowId": "SkyBow",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SkyBow_2": {
    "recipes": [
      {
        "sourceRowId": "SkyBow_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 250
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkyBow_3": {
    "recipes": [
      {
        "sourceRowId": "SkyBow_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 300
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 4
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkyBow_4": {
    "recipes": [
      {
        "sourceRowId": "SkyBow_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 70
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 35
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 350
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkyBow_5": {
    "recipes": [
      {
        "sourceRowId": "SkyBow_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 40
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 400
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkyBowArrow": {
    "recipes": [
      {
        "sourceRowId": "SkyBowArrow",
        "resultCount": 10,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SkyGrenadeLauncher": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncher",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 80
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 15
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkyGrenadeLauncher_2": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncher_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 18
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkyGrenadeLauncher_3": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncher_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 22
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkyGrenadeLauncher_4": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncher_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 140
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 26
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkyGrenadeLauncher_5": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncher_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 160
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 30
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkyGrenadeLauncherBullet": {
    "recipes": [
      {
        "sourceRowId": "SkyGrenadeLauncherBullet",
        "resultCount": 10,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 4
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 10
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SkyislandIngot": {
    "recipes": [
      {
        "sourceRowId": "SkyislandIngot",
        "resultCount": 1,
        "workAmount": 700000,
        "materials": [
          {
            "sourceInternalId": "SkyIslandOre",
            "quantity": 2
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SkyIslandOre": {
    "chest": true,
    "gathering": true
  },
  "SkyShotgun": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgun",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 40
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 5
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SkyShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgun_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 50
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 6
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkyShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgun_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 90
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 7
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkyShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgun_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 105
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 70
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 8
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkyShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgun_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 80
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 10
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkyShotgunBullet": {
    "recipes": [
      {
        "sourceRowId": "SkyShotgunBullet",
        "resultCount": 10,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 4
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 8
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "SkySubmachineGun": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGun",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 20
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "SkySubmachineGun_2": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGun_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 37
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 25
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SkySubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGun_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 45
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 30
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "SkySubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGun_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 52
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 35
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SkySubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGun_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 60
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 40
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "SkySubmachineGunBullet": {
    "recipes": [
      {
        "sourceRowId": "SkySubmachineGunBullet",
        "resultCount": 20,
        "workAmount": 250000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          },
          {
            "sourceInternalId": "Gunpowder2",
            "quantity": 6
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "Spear": {
    "recipes": [
      {
        "sourceRowId": "Spear",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 18
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "Spear_2": {
    "recipes": [
      {
        "sourceRowId": "Spear_2",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 27
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 12
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Spear_3": {
    "recipes": [
      {
        "sourceRowId": "Spear_3",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 36
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 18
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Spear_ForestBoss": {
    "recipes": [
      {
        "sourceRowId": "Spear_ForestBoss",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "Spear_ForestBoss_5": {
    "recipes": [
      {
        "sourceRowId": "Spear_ForestBoss_5",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 30
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "Spear_ForestBoss2": {
    "recipes": [
      {
        "sourceRowId": "Spear_ForestBoss2",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 20
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Spear_ForestBoss2_5": {
    "recipes": [
      {
        "sourceRowId": "Spear_ForestBoss2_5",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 30
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 40
          }
        ]
      }
    ]
  },
  "Spear_QueenBee": {
    "recipes": [
      {
        "sourceRowId": "Spear_QueenBee",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 1
          },
          {
            "sourceInternalId": "Honey",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "SphereLauncher": {
    "recipes": [
      {
        "sourceRowId": "SphereLauncher",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 15
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SphereLauncher_Once": {
    "recipes": [
      {
        "sourceRowId": "SphereLauncher_Once",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 100
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SphereModule_Curve": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Curve",
        "resultCount": 1,
        "workAmount": 45000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SphereModule_Curve2": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Curve2",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 100
          },
          {
            "sourceInternalId": "IronIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 15
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "SphereModule_Heavy": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Heavy",
        "resultCount": 1,
        "workAmount": 3000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "SphereModule_Homing": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Homing",
        "resultCount": 1,
        "workAmount": 10000000,
        "materials": [
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 3
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalDarkParts",
            "quantity": 50
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "SphereModule_Sniper": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Sniper",
        "resultCount": 1,
        "workAmount": 130000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 50
          },
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Cement",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "SphereModule_Sniper2": {
    "recipes": [
      {
        "sourceRowId": "SphereModule_Sniper2",
        "resultCount": 1,
        "workAmount": 2000000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 200
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 20
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SpringRolls": {
    "recipes": [
      {
        "sourceRowId": "SpringRolls",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Mushroom",
            "quantity": 2
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "StainlessSteel": {
    "recipes": [
      {
        "sourceRowId": "StainlessSteel",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "Chromium",
            "quantity": 1
          },
          {
            "sourceInternalId": "RainbowCrystal",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "StatusPointResetSan": {
    "recipes": [
      {
        "sourceRowId": "StatusPointResetSan",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "Poppy",
            "quantity": 99
          },
          {
            "sourceInternalId": "Horn",
            "quantity": 50
          },
          {
            "sourceInternalId": "Bone",
            "quantity": 50
          },
          {
            "sourceInternalId": "PalFluid",
            "quantity": 50
          }
        ]
      }
    ]
  },
  "StealArmor": {
    "recipes": [
      {
        "sourceRowId": "StealArmor",
        "resultCount": 1,
        "workAmount": 150000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "StealArmorCold": {
    "recipes": [
      {
        "sourceRowId": "StealArmorCold",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "StealArmorCold_2": {
    "recipes": [
      {
        "sourceRowId": "StealArmorCold_2",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "StealArmorCold_3": {
    "recipes": [
      {
        "sourceRowId": "StealArmorCold_3",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 4
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "StealArmorCold_4": {
    "recipes": [
      {
        "sourceRowId": "StealArmorCold_4",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "StealArmorCold_5": {
    "recipes": [
      {
        "sourceRowId": "StealArmorCold_5",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "Bio_Coolant",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "StealArmorHeat": {
    "recipes": [
      {
        "sourceRowId": "StealArmorHeat",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 30
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 16
          }
        ]
      }
    ]
  },
  "StealArmorHeat_2": {
    "recipes": [
      {
        "sourceRowId": "StealArmorHeat_2",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 37
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 3
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "StealArmorHeat_3": {
    "recipes": [
      {
        "sourceRowId": "StealArmorHeat_3",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 45
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 4
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 24
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "StealArmorHeat_4": {
    "recipes": [
      {
        "sourceRowId": "StealArmorHeat_4",
        "resultCount": 1,
        "workAmount": 3200000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 52
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 5
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 28
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "StealArmorHeat_5": {
    "recipes": [
      {
        "sourceRowId": "StealArmorHeat_5",
        "resultCount": 1,
        "workAmount": 6400000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 60
          },
          {
            "sourceInternalId": "Cloth2",
            "quantity": 6
          },
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 32
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "StealHelmet": {
    "recipes": [
      {
        "sourceRowId": "StealHelmet",
        "resultCount": 1,
        "workAmount": 120000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "StealHelmet_2": {
    "recipes": [
      {
        "sourceRowId": "StealHelmet_2",
        "resultCount": 1,
        "workAmount": 480000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 25
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "StealHelmet_3": {
    "recipes": [
      {
        "sourceRowId": "StealHelmet_3",
        "resultCount": 1,
        "workAmount": 960000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "StealHelmet_4": {
    "recipes": [
      {
        "sourceRowId": "StealHelmet_4",
        "resultCount": 1,
        "workAmount": 1920000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 35
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "StealHelmet_5": {
    "recipes": [
      {
        "sourceRowId": "StealHelmet_5",
        "resultCount": 1,
        "workAmount": 3840000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 40
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "StealIngot": {
    "recipes": [
      {
        "sourceRowId": "StealIngot",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperOre",
            "quantity": 4
          },
          {
            "sourceInternalId": "Quartz",
            "quantity": 1
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "StewedIceDeer": {
    "recipes": [
      {
        "sourceRowId": "StewedIceDeer",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Meat_IceDeer",
            "quantity": 1
          },
          {
            "sourceInternalId": "Tomato",
            "quantity": 2
          }
        ]
      }
    ],
    "chest": true
  },
  "StirFriedVegetables": {
    "recipes": [
      {
        "sourceRowId": "StirFriedVegetables",
        "resultCount": 1,
        "workAmount": 7000,
        "materials": [
          {
            "sourceInternalId": "Onion",
            "quantity": 2
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Stone": {
    "merchant": true,
    "gathering": true
  },
  "SubmachineGun": {
    "recipes": [
      {
        "sourceRowId": "SubmachineGun",
        "resultCount": 1,
        "workAmount": 75000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 25
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 6
          }
        ]
      }
    ]
  },
  "SubmachineGun_2": {
    "recipes": [
      {
        "sourceRowId": "SubmachineGun_2",
        "resultCount": 1,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 31
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "SubmachineGun_3": {
    "recipes": [
      {
        "sourceRowId": "SubmachineGun_3",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 9
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "SubmachineGun_4": {
    "recipes": [
      {
        "sourceRowId": "SubmachineGun_4",
        "resultCount": 1,
        "workAmount": 1200000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 43
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "SubmachineGun_5": {
    "recipes": [
      {
        "sourceRowId": "SubmachineGun_5",
        "resultCount": 1,
        "workAmount": 2400000,
        "materials": [
          {
            "sourceInternalId": "IronIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "Polymer",
            "quantity": 12
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 4
          }
        ]
      }
    ]
  },
  "Sulfur": {
    "chest": true,
    "gathering": true
  },
  "Supplement": {
    "recipes": [
      {
        "sourceRowId": "Supplement",
        "resultCount": 1,
        "workAmount": 15000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 25
          },
          {
            "sourceInternalId": "Sweet_Caramel",
            "quantity": 18
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 20
          },
          {
            "sourceInternalId": "CaveMushroom",
            "quantity": 10
          }
        ]
      }
    ],
    "chest": true
  },
  "Sweet": {
    "chest": true
  },
  "Sweet_Caramel": {
    "chest": true
  },
  "Sword": {
    "recipes": [
      {
        "sourceRowId": "Sword",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Sword_2": {
    "recipes": [
      {
        "sourceRowId": "Sword_2",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 37
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "Sword_3": {
    "recipes": [
      {
        "sourceRowId": "Sword_3",
        "resultCount": 1,
        "workAmount": 400000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 45
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 3
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "Sword_4": {
    "recipes": [
      {
        "sourceRowId": "Sword_4",
        "resultCount": 1,
        "workAmount": 800000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 52
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 4
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 35
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "Sword_5": {
    "recipes": [
      {
        "sourceRowId": "Sword_5",
        "resultCount": 1,
        "workAmount": 1600000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 5
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 40
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "TechnologyBook_G1": {
    "merchant": true,
    "chest": true
  },
  "TechnologyBook_G2": {
    "chest": true
  },
  "TechnologyBook_G3": {
    "chest": true
  },
  "Thermal_Core": {
    "recipes": [
      {
        "sourceRowId": "Thermal_Core",
        "resultCount": 1,
        "workAmount": 500000,
        "materials": [
          {
            "sourceInternalId": "FireOrgan",
            "quantity": 4
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 8
          },
          {
            "sourceInternalId": "Corrosive_Solvent",
            "quantity": 2
          },
          {
            "sourceInternalId": "StainlessSteel",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "Tomato": {
    "merchant": true
  },
  "TomatoSeeds": {
    "merchant": true,
    "chest": true
  },
  "Torch": {
    "recipes": [
      {
        "sourceRowId": "Torch",
        "resultCount": 1,
        "workAmount": 1000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 2
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 2
          }
        ]
      }
    ]
  },
  "TreasureBoxKey01": {
    "chest": true
  },
  "TreasureBoxKey02": {
    "chest": true
  },
  "TreasureBoxKey03": {
    "chest": true
  },
  "TreasureMap01": {
    "chest": true
  },
  "TreasureMap02": {
    "chest": true
  },
  "TreasureMap03": {
    "chest": true
  },
  "TreasureMap04": {
    "chest": true
  },
  "TreasureMap05": {
    "chest": true
  },
  "Unlock_Picking_Tier1": {
    "recipes": [
      {
        "sourceRowId": "Unlock_Picking_Tier1",
        "resultCount": 1,
        "workAmount": 10000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 10
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 10
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "Unlock_Picking_Tier2": {
    "recipes": [
      {
        "sourceRowId": "Unlock_Picking_Tier2",
        "resultCount": 1,
        "workAmount": 30000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 20
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "Unlock_Picking_Tier3": {
    "recipes": [
      {
        "sourceRowId": "Unlock_Picking_Tier3",
        "resultCount": 1,
        "workAmount": 100000,
        "materials": [
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "MachineParts",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "UnlockEquipmentSlot_Accessory_01": {
    "merchant": true
  },
  "UnlockEquipmentSlot_Accessory_02": {
    "merchant": true
  },
  "UnlockEquipmentSlot_Weapon_01": {
    "recipes": [
      {
        "sourceRowId": "UnlockEquipmentSlot_Weapon_01",
        "resultCount": 1,
        "workAmount": 50000,
        "materials": [
          {
            "sourceInternalId": "Processed_Wood",
            "quantity": 20
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 30
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "UnlockEquipmentSlot_Weapon_02": {
    "recipes": [
      {
        "sourceRowId": "UnlockEquipmentSlot_Weapon_02",
        "resultCount": 1,
        "workAmount": 200000,
        "materials": [
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 40
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 100
          },
          {
            "sourceInternalId": "Leather",
            "quantity": 40
          },
          {
            "sourceInternalId": "CarbonFiber",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Venom": {
    "merchant": true,
    "chest": true
  },
  "WaterBuildKit": {
    "recipes": [
      {
        "sourceRowId": "WaterBuildKit",
        "resultCount": 1,
        "workAmount": 600000,
        "materials": [
          {
            "sourceInternalId": "Cement",
            "quantity": 200
          },
          {
            "sourceInternalId": "ManganeseIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "HighGrade_Processed_Wood",
            "quantity": 100
          }
        ]
      }
    ]
  },
  "WeakerBow": {
    "recipes": [
      {
        "sourceRowId": "WeakerBow",
        "resultCount": 1,
        "workAmount": 2000,
        "materials": [
          {
            "sourceInternalId": "Wood",
            "quantity": 30
          },
          {
            "sourceInternalId": "Stone",
            "quantity": 5
          },
          {
            "sourceInternalId": "Fiber",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "Wheat": {
    "merchant": true
  },
  "WheatSeeds": {
    "merchant": true,
    "chest": true
  },
  "WidePenetrateShotgun": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgun",
        "resultCount": 1,
        "workAmount": 3500000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 50
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 5
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "WidePenetrateShotgun_2": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgun_2",
        "resultCount": 1,
        "workAmount": 14000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 62
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 6
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 6
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "WidePenetrateShotgun_3": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgun_3",
        "resultCount": 1,
        "workAmount": 28000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 75
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 7
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 7
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 8
          }
        ]
      }
    ]
  },
  "WidePenetrateShotgun_4": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgun_4",
        "resultCount": 1,
        "workAmount": 56000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 87
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 8
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 8
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 9
          }
        ]
      }
    ]
  },
  "WidePenetrateShotgun_5": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgun_5",
        "resultCount": 1,
        "workAmount": 112000000,
        "materials": [
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 100
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 10
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 10
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "WidePenetrateShotgunBullet": {
    "recipes": [
      {
        "sourceRowId": "WidePenetrateShotgunBullet",
        "resultCount": 10,
        "workAmount": 300000,
        "materials": [
          {
            "sourceInternalId": "Bio_Battery",
            "quantity": 1
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 3
          },
          {
            "sourceInternalId": "SkyislandIngot",
            "quantity": 2
          }
        ]
      }
    ],
    "merchant": true,
    "chest": true
  },
  "WingGlider": {
    "recipes": [
      {
        "sourceRowId": "WingGlider",
        "resultCount": 1,
        "workAmount": 3000000,
        "materials": [
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 30
          },
          {
            "sourceInternalId": "WorldTreeIngot",
            "quantity": 6
          },
          {
            "sourceInternalId": "AIcore",
            "quantity": 20
          },
          {
            "sourceInternalId": "Thermal_Core",
            "quantity": 20
          },
          {
            "sourceInternalId": "AncientParts2",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "WingGlider_Fuel": {
    "recipes": [
      {
        "sourceRowId": "WingGlider_Fuel",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "Wood_WorldTree",
            "quantity": 10
          },
          {
            "sourceInternalId": "CrudeOil",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "Wood": {
    "merchant": true,
    "chest": true,
    "gathering": true
  },
  "Wood_Fine": {
    "merchant": true,
    "gathering": true
  },
  "Wood_WorldTree": {
    "chest": true
  },
  "Wool": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Collection": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Cool": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Deforest": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_EmitFlame": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_GenerateElectricity": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Handcraft": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Mining": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_MonsterFarm": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_ProductMedicine": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Seeding": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Transport": {
    "merchant": true,
    "chest": true
  },
  "WorkSuitability_AddTicket_Watering": {
    "merchant": true,
    "chest": true
  },
  "WorldTreeHolyWater": {
    "chest": true
  },
  "WorldTreeIngot": {
    "recipes": [
      {
        "sourceRowId": "WorldTreeIngot",
        "resultCount": 1,
        "workAmount": 1000000,
        "materials": [
          {
            "sourceInternalId": "SkyIslandOre",
            "quantity": 1
          },
          {
            "sourceInternalId": "WorldTreeOre",
            "quantity": 2
          },
          {
            "sourceInternalId": "WorldTreeHolyWater",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "WorldTreeOre": {
    "chest": true
  },
  "WorldTreeRelic_01": {
    "chest": true
  },
  "WorldTreeRelic_02": {
    "chest": true
  },
  "WorldTreeRelic_03": {
    "chest": true
  },
  "WorldTreeRelic_04": {
    "chest": true
  },
  "WorldTreeRelic_05": {
    "chest": true
  },
  "Yakisoba": {
    "recipes": [
      {
        "sourceRowId": "Yakisoba",
        "resultCount": 1,
        "workAmount": 32000,
        "materials": [
          {
            "sourceInternalId": "Meat_SakuraSaurus",
            "quantity": 1
          },
          {
            "sourceInternalId": "Onion",
            "quantity": 1
          },
          {
            "sourceInternalId": "Carrot",
            "quantity": 1
          },
          {
            "sourceInternalId": "Flour",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "YakushimaArmor001": {
    "recipes": [
      {
        "sourceRowId": "YakushimaArmor001",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaArmor001_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaArmor001_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaArmor001_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaArmor001_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaArmor001_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaArmor001_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaArmor001_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaArmor001_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaBlade": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "CopperIngot",
            "quantity": 22
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 22
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 22
          }
        ]
      }
    ]
  },
  "YakushimaBlade002": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade002",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaBlade002_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade002_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaBlade002_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade002_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaBlade002_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade002_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaBlade002_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade002_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 480
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaBlade003": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade003",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "YakushimaBlade003_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade003_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "YakushimaBlade003_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade003_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "YakushimaBlade003_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade003_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "YakushimaBlade003_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade003_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 480
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 240
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "YakushimaBlade004": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade004",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaBlade004_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade004_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 45
          }
        ]
      }
    ]
  },
  "YakushimaBlade004_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade004_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 90
          }
        ]
      }
    ]
  },
  "YakushimaBlade004_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade004_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 180
          }
        ]
      }
    ]
  },
  "YakushimaBlade004_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade004_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 360
          }
        ]
      }
    ]
  },
  "YakushimaBlade005": {
    "recipes": [
      {
        "sourceRowId": "YakushimaBlade005",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 22
          },
          {
            "sourceInternalId": "Pal_crystal_S",
            "quantity": 22
          },
          {
            "sourceInternalId": "Coal",
            "quantity": 22
          }
        ]
      }
    ]
  },
  "YakushimaGun001": {
    "recipes": [
      {
        "sourceRowId": "YakushimaGun001",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "YakushimaGun001_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaGun001_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "YakushimaGun001_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaGun001_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 15
          }
        ]
      }
    ]
  },
  "YakushimaGun001_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaGun001_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaGun001_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaGun001_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 480
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 240
          },
          {
            "sourceInternalId": "ElectricOrgan",
            "quantity": 25
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip001": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip001",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip001_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip001_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip001_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip001_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip001_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip001_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip001_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip001_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip002": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip002",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip002_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip002_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip002_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip002_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip002_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip002_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip002_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip002_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip003": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip003",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip003_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip003_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip003_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip003_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip003_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip003_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip003_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip003_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip004": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip004",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 20
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip004_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip004_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 30
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip004_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip004_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip004_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip004_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip004_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip004_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip005": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip005",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "YakushimaHeadEquip006": {
    "recipes": [
      {
        "sourceRowId": "YakushimaHeadEquip006",
        "resultCount": 1,
        "workAmount": 15000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 1
          }
        ]
      }
    ]
  },
  "YakushimaIngot001": {
    "chest": true
  },
  "YakushimaLantern001": {
    "recipes": [
      {
        "sourceRowId": "YakushimaLantern001",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 40
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 20
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 3
          }
        ]
      }
    ]
  },
  "YakushimaLantern001_2": {
    "recipes": [
      {
        "sourceRowId": "YakushimaLantern001_2",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 60
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 30
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 5
          }
        ]
      }
    ]
  },
  "YakushimaLantern001_3": {
    "recipes": [
      {
        "sourceRowId": "YakushimaLantern001_3",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 120
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 60
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 7
          }
        ]
      }
    ]
  },
  "YakushimaLantern001_4": {
    "recipes": [
      {
        "sourceRowId": "YakushimaLantern001_4",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 240
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 120
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 10
          }
        ]
      }
    ]
  },
  "YakushimaLantern001_5": {
    "recipes": [
      {
        "sourceRowId": "YakushimaLantern001_5",
        "resultCount": 1,
        "workAmount": 40000,
        "materials": [
          {
            "sourceInternalId": "YakushimaIngot001",
            "quantity": 480
          },
          {
            "sourceInternalId": "StealIngot",
            "quantity": 240
          },
          {
            "sourceInternalId": "PalCrystal_Ex",
            "quantity": 15
          }
        ]
      }
    ]
  }
},
) as Readonly<Record<string, PalworldGeneratedItemDetailSource>>;

export const PALWORLD_CRAFTING_FACILITY_RULES = Object.freeze(
[
  {
    "sourceRowId": "CompositeDesk",
    "targetTypesA": [
      "Blueprint"
    ],
    "targetTypesB": [
      "Blueprint"
    ],
    "targetRankMax": 1
  },
  {
    "sourceRowId": "Product_Cooking_Grade_01",
    "targetTypesA": [
      "Food",
      "Material"
    ],
    "targetTypesB": [
      "FoodDishFish",
      "FoodDishMeat",
      "FoodDishVegetable"
    ],
    "targetRankMax": 1
  },
  {
    "sourceRowId": "Product_Ingot_Grade_01_Copper",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialIngot"
    ],
    "targetRankMax": 1
  },
  {
    "sourceRowId": "Workbench",
    "targetTypesA": [
      "Ammo",
      "Armor",
      "Consume",
      "Essential",
      "Glider",
      "Material",
      "SpecialWeapon",
      "Weapon"
    ],
    "targetTypesB": [
      "ArmorBody",
      "ArmorHead",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeOther",
      "Essential_AdditionalInventory",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "Shield",
      "SPWeaponCaptureBall",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponThrowObject"
    ],
    "targetRankMax": 1
  },
  {
    "sourceRowId": "Crusher",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialMonster",
      "MaterialOre",
      "MaterialWood"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "FlourMill",
    "targetTypesA": [
      "Food"
    ],
    "targetTypesB": [
      "FoodVegetable"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "IceCrusher",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialMonster",
      "MaterialOre",
      "MaterialWood"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "Product_Cooking_Grade_02",
    "targetTypesA": [
      "Food"
    ],
    "targetTypesB": [
      "FoodDishFish",
      "FoodDishMeat",
      "FoodDishVegetable"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "Product_Factory_Hard_Grade_01",
    "targetTypesA": [
      "Accessory",
      "Ammo",
      "Armor",
      "Consume",
      "Essential",
      "Glider",
      "Material",
      "Weapon"
    ],
    "targetTypesB": [
      "Accessory",
      "ArmorBody",
      "ArmorHead",
      "ConsumeBandage",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeOther",
      "Essential_AdditionalInventory",
      "Essential_Lamp",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "ReturnToBaseCamp",
      "Shield",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponGrapplingGun",
      "WeaponMelee"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "Product_Ingot_Grade_02_Iron",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialIngot"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "Product_WeaponFactory_Dirty_Grade_01",
    "targetTypesA": [],
    "targetTypesB": [
      "ConsumeBullet",
      "WeaponAssaultRifle",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponGrapplingGun",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponRocketLauncher",
      "WeaponShotgun",
      "WeaponThrowObject"
    ],
    "targetRankMax": 2
  },
  {
    "sourceRowId": "Factory_Money",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "Money"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Product_Cooking_Grade_03",
    "targetTypesA": [
      "Food"
    ],
    "targetTypesB": [
      "FoodDishFish",
      "FoodDishMeat",
      "FoodDishVegetable"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Product_Factory_Hard_Grade_02",
    "targetTypesA": [
      "Accessory",
      "Ammo",
      "Armor",
      "Consume",
      "Essential",
      "Glider",
      "Material",
      "Weapon"
    ],
    "targetTypesB": [
      "Accessory",
      "ArmorBody",
      "ArmorHead",
      "ConsumeBandage",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeOther",
      "Essential_AdditionalInventory",
      "Essential_Lamp",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "ReturnToBaseCamp",
      "Shield",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponGrapplingGun",
      "WeaponMelee"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Product_Ingot_Grade_03_Steal",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialIngot"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Product_Medicine_Grade_01",
    "targetTypesA": [
      "Consume",
      "Food",
      "Material"
    ],
    "targetTypesB": [
      "ConsumeGainStatusPoints",
      "Drug",
      "Medicine"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Product_WeaponFactory_Dirty_Grade_02",
    "targetTypesA": [
      "Ammo",
      "Consume",
      "Weapon"
    ],
    "targetTypesB": [
      "ConsumeBullet",
      "WeaponAssaultRifle",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponGrapplingGun",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponRocketLauncher",
      "WeaponShotgun",
      "WeaponSniperRifle",
      "WeaponThrowObject"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "Special_SphereFactory_Black_Grade_01",
    "targetTypesA": [
      "CaptureItemModifier",
      "SpecialWeapon"
    ],
    "targetTypesB": [
      "CaptureItemModifier",
      "SPWeaponCaptureBall"
    ],
    "targetRankMax": 3
  },
  {
    "sourceRowId": "BlastFurnace4",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialIngot"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "HugeKitchen",
    "targetTypesA": [
      "Food"
    ],
    "targetTypesB": [
      "FoodDishFish",
      "FoodDishMeat",
      "FoodDishVegetable"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "Product_Factory_Hard_Grade_03",
    "targetTypesA": [
      "Accessory",
      "Ammo",
      "Armor",
      "Consume",
      "Essential",
      "Glider",
      "Material",
      "Weapon"
    ],
    "targetTypesB": [
      "Accessory",
      "ArmorBody",
      "ArmorHead",
      "ConsumeBandage",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeOther",
      "ConsumePalGainExp",
      "Essential_AdditionalInventory",
      "Essential_Lamp",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "ReturnToBaseCamp",
      "Shield",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponGrapplingGun",
      "WeaponMelee",
      "WeaponMetalDetector"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "Product_Medicine_Grade_02",
    "targetTypesA": [
      "Consume",
      "Food",
      "Material"
    ],
    "targetTypesB": [
      "ConsumeGainStatusPoints",
      "Drug",
      "Medicine"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "Product_WeaponFactory_Dirty_Grade_03",
    "targetTypesA": [
      "Ammo",
      "Consume",
      "Weapon"
    ],
    "targetTypesB": [
      "ConsumeBullet",
      "WeaponAssaultRifle",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFlameThrower",
      "WeaponGatlingGun",
      "WeaponGrapplingGun",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponRocketLauncher",
      "WeaponShotgun",
      "WeaponSniperRifle",
      "WeaponThrowObject"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "Product_WorkBench_SkillUnlock",
    "targetTypesA": [
      "Essential"
    ],
    "targetTypesB": [
      "Essential_PalGear"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "Special_SphereFactory_Black_Grade_02",
    "targetTypesA": [
      "CaptureItemModifier",
      "SpecialWeapon"
    ],
    "targetTypesB": [
      "CaptureItemModifier",
      "SPWeaponCaptureBall"
    ],
    "targetRankMax": 4
  },
  {
    "sourceRowId": "AncientCookingStove",
    "targetTypesA": [
      "Food"
    ],
    "targetTypesB": [
      "FoodDishFish",
      "FoodDishMeat",
      "FoodDishVegetable"
    ],
    "targetRankMax": 5
  },
  {
    "sourceRowId": "Factory_Hard_04",
    "targetTypesA": [
      "Accessory",
      "Ammo",
      "Armor",
      "Consume",
      "Essential",
      "Glider",
      "Material",
      "Weapon"
    ],
    "targetTypesB": [
      "Accessory",
      "ArmorBody",
      "ArmorHead",
      "ConsumeBandage",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeOther",
      "ConsumePalGainExp",
      "Essential_AdditionalInventory",
      "Essential_Lamp",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "ReturnToBaseCamp",
      "Shield",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponGrapplingGun",
      "WeaponMelee",
      "WeaponMetalDetector"
    ],
    "targetRankMax": 5
  },
  {
    "sourceRowId": "WeaponFactory_Dirty_04",
    "targetTypesA": [
      "Ammo",
      "Consume",
      "Weapon"
    ],
    "targetTypesB": [
      "ConsumeBullet",
      "WeaponAssaultRifle",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFlameThrower",
      "WeaponGatlingGun",
      "WeaponGrapplingGun",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponRocketLauncher",
      "WeaponShotgun",
      "WeaponSniperRifle",
      "WeaponThrowObject"
    ],
    "targetRankMax": 5
  },
  {
    "sourceRowId": "Special_SphereFactory_Black_Grade_03",
    "targetTypesA": [
      "CaptureItemModifier",
      "SpecialWeapon"
    ],
    "targetTypesB": [
      "CaptureItemModifier",
      "SPWeaponCaptureBall"
    ],
    "targetRankMax": 6
  },
  {
    "sourceRowId": "AncientBlastFurnace",
    "targetTypesA": [
      "Material"
    ],
    "targetTypesB": [
      "MaterialIngot"
    ],
    "targetRankMax": 7
  },
  {
    "sourceRowId": "SphereFactory_Black_04",
    "targetTypesA": [
      "CaptureItemModifier",
      "SpecialWeapon"
    ],
    "targetTypesB": [
      "CaptureItemModifier",
      "SPWeaponCaptureBall"
    ],
    "targetRankMax": 7
  },
  {
    "sourceRowId": "AncientWorkBench",
    "targetTypesA": [
      "Accessory",
      "Ammo",
      "Armor",
      "CaptureItemModifier",
      "Consume",
      "Essential",
      "Food",
      "Glider",
      "Material",
      "SpecialWeapon",
      "Weapon"
    ],
    "targetTypesB": [
      "Accessory",
      "ArmorBody",
      "ArmorHead",
      "CaptureItemModifier",
      "ConsumeBandage",
      "ConsumeBullet",
      "ConsumeFishingBait",
      "ConsumeGainStatusPoints",
      "ConsumeOther",
      "ConsumePalAwakening",
      "ConsumePalRevive",
      "ConsumePalTalentUp",
      "Drug",
      "Essential_AdditionalInventory",
      "Essential_Lamp",
      "Essential_PalGear",
      "Essential_UnlockPlayerFuture",
      "Glider",
      "MaterialProccessing",
      "Medicine",
      "ReturnToBaseCamp",
      "Shield",
      "SPWeaponCaptureBall",
      "WeaponAssaultRifle",
      "WeaponBow",
      "WeaponCrossbow",
      "WeaponFishingRod",
      "WeaponFlameThrower",
      "WeaponGatlingGun",
      "WeaponGrapplingGun",
      "WeaponHandgun",
      "WeaponMelee",
      "WeaponMetalDetector",
      "WeaponRocketLauncher",
      "WeaponShotgun",
      "WeaponSniperRifle",
      "WeaponThrowObject"
    ],
    "targetRankMax": 10
  },
  {
    "sourceRowId": "MedicineFacility_03",
    "targetTypesA": [
      "Consume",
      "Food",
      "Material"
    ],
    "targetTypesB": [
      "ConsumeGainStatusPoints",
      "ConsumePalRevive",
      "Drug",
      "Medicine"
    ],
    "targetRankMax": 10
  }
],
) as readonly PalworldGeneratedFacilityRule[];
