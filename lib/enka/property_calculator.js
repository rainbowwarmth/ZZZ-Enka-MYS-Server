// property_calculator.js (Refactored to use data_loader and constants)

import _ from 'lodash';
// --- Import Data Loaders and Constants ---
import {
    getHakushCharacterData,
    getHakushWeaponData,
    getDriveSetData,      // Provides descriptions for set bonuses
    getDriveLevelMap      // Provides drive level scaling data
} from './data_loader.js'; // Adjust path as needed
import { ID_TO_EN, ID_TO_PROP_NAME } from './constants.js'; // Adjust path as needed

const logger = console; // Use your project's logger

// --- TEMPORARY: Keep propIdInfo and getPropInfo locally until fully refactored ---
// TODO: Refactor this to derive type information from constants.js if possible
const propIdInfo = {
    11101: { name: "HP_BASE", type: 'base' }, 11102: { name: "HP%", type: 'percent' }, 11103: { name: "HP_FLAT", type: 'flat' },
    12101: { name: "ATK_BASE", type: 'base' }, 12102: { name: "ATK%", type: 'percent' }, 12103: { name: "ATK_FLAT", type: 'flat' },
    13101: { name: "DEF_BASE", type: 'base' }, 13102: { name: "DEF%", type: 'percent' }, 13103: { name: "DEF_FLAT", type: 'flat' },
    12201: { name: "IMPACT_BASE", type: 'other_flat' }, 12202: { name: "IMPACT%", type: 'percent' }, 12203: { name: "IMPACT", type: 'other_flat' },
    20101: { name: "CRIT_RATE_BASE", type: 'special_percent_base' }, 20103: { name: "CRIT_RATE", type: 'special_percent' },
    21101: { name: "CRIT_DMG_BASE", type: 'special_percent_base' }, 21103: { name: "CRIT_DMG", type: 'special_percent' },
    23101: { name: "PEN_RATIO_BASE", type: 'special_percent_base' }, 23103: { name: "PEN_RATIO", type: 'special_percent' },
    23201: { name: "PEN_VALUE_BASE", type: 'other_flat' }, 23203: { name: "PEN_VALUE", type: 'other_flat' },
    30501: { name: "ENERGY_REGEN_BASE", type: 'special_percent_base' }, 30502: { name: "ENERGY_REGEN%", type: 'percent' }, 30503: { name: "ENERGY_REGEN", type: 'special_percent' }, // Check if ENERGY_REGEN should be other_flat or special_percent
    31201: { name: "ANOMALY_PROFICIENCY_BASE", type: 'other_flat' }, 31203: { name: "ANOMALY_PROFICIENCY", type: 'other_flat' },
    31401: { name: "ANOMALY_MASTERY_BASE", type: 'other_flat' }, 31402: { name: "ANOMALY_MASTERY%", type: 'percent' }, 31403: { name: "ANOMALY_MASTERY", type: 'other_flat' },
    31501: { name: "PHYS_DMG_BASE", type: 'special_percent_base' }, 31503: { name: "PHYS_DMG", type: 'special_percent' },
    31601: { name: "FIRE_DMG_BASE", type: 'special_percent_base' }, 31603: { name: "FIRE_DMG", type: 'special_percent' },
    31701: { name: "ICE_DMG_BASE", type: 'special_percent_base' }, 31703: { name: "ICE_DMG", type: 'special_percent' },
    31801: { name: "ELEC_DMG_BASE", type: 'special_percent_base' }, 31803: { name: "ELEC_DMG", type: 'special_percent' },
    31901: { name: "ETHER_DMG_BASE", type: 'special_percent_base' }, 31903: { name: "ETHER_DMG", type: 'special_percent' },
};
function getPropInfo(id) { return propIdInfo[id] || { name: `UNKNOWN_${id}`, type: 'unknown' }; }
// --- END TEMPORARY ---


// --- Set Bonus Parser (Kept as is, relies on desc strings) ---
function parseSetBonus(desc, targetStatMap) {
    // ... (Keep the existing parseSetBonus function code exactly as it was) ...
     const percentMatch = desc.match(/([\u4e00-\u9fa5\w]+)\+([0-9.]+)%/);
     if (percentMatch) {
         const name = percentMatch[1]; const value = parseFloat(percentMatch[2]);
         if (!isNaN(value)) {
             const fracValue = value / 100;
             // Use targetStatMap.percent for percentages, targetStatMap.flat for flat values
             if (name.includes("暴击率")) targetStatMap.percent["CRIT_RATE"] = (targetStatMap.percent["CRIT_RATE"] || 0) + fracValue;
             else if (name.includes("暴击伤害")) targetStatMap.percent["CRIT_DMG"] = (targetStatMap.percent["CRIT_DMG"] || 0) + fracValue;
             else if (name.includes("攻击力")) targetStatMap.percent["ATK%"] = (targetStatMap.percent["ATK%"] || 0) + fracValue;
             else if (name.includes("防御力")) targetStatMap.percent["DEF%"] = (targetStatMap.percent["DEF%"] || 0) + fracValue;
             else if (name.includes("生命值")) targetStatMap.percent["HP%"] = (targetStatMap.percent["HP%"] || 0) + fracValue;
             else if (name.includes("护盾值")) targetStatMap.percent["SHIELD%"] = (targetStatMap.percent["SHIELD%"] || 0) + fracValue; // Assuming SHIELD% key exists if needed
             else if (name.includes("冲击力")) targetStatMap.percent["IMPACT%"] = (targetStatMap.percent["IMPACT%"] || 0) + fracValue;
             else if (name.includes("穿透率")) targetStatMap.percent["PEN_RATIO"] = (targetStatMap.percent["PEN_RATIO"] || 0) + fracValue;
             else if (name.includes("能量自动回复")) targetStatMap.percent["ENERGY_REGEN%"] = (targetStatMap.percent["ENERGY_REGEN%"] || 0) + fracValue; // Note: MYS usually has efficiency (%)
             else if (name.includes("异常掌控")) targetStatMap.percent["ANOMALY_MASTERY%"] = (targetStatMap.percent["ANOMALY_MASTERY%"] || 0) + fracValue;
             else if (name.includes("物理伤害")) targetStatMap.percent["PHYS_DMG"] = (targetStatMap.percent["PHYS_DMG"] || 0) + fracValue;
             else if (name.includes("火属性伤害")) targetStatMap.percent["FIRE_DMG"] = (targetStatMap.percent["FIRE_DMG"] || 0) + fracValue;
             else if (name.includes("冰属性伤害")) targetStatMap.percent["ICE_DMG"] = (targetStatMap.percent["ICE_DMG"] || 0) + fracValue;
             else if (name.includes("电属性伤害") || name.includes("雷属性伤害")) targetStatMap.percent["ELEC_DMG"] = (targetStatMap.percent["ELEC_DMG"] || 0) + fracValue;
             else if (name.includes("以太伤害")) targetStatMap.percent["ETHER_DMG"] = (targetStatMap.percent["ETHER_DMG"] || 0) + fracValue;
             else { logger.warn(`[parseSetBonus] Unhandled percent stat name: ${name}`); return false; }
             return true;
         }
     }
     // Keep flat bonus parsing as well
     const flatMatch = desc.match(/([\u4e00-\u9fa5\w]+)\+([0-9.]+)点?/); // Optional "点"
     if (flatMatch) {
         const name = flatMatch[1]; const value = parseFloat(flatMatch[2]);
         if (!isNaN(value)) {
             if (name.includes("异常精通")) targetStatMap.flat["ANOMALY_PROFICIENCY"] = (targetStatMap.flat["ANOMALY_PROFICIENCY"] || 0) + value;
             else if (name.includes("异常掌控")) targetStatMap.flat["ANOMALY_MASTERY"] = (targetStatMap.flat["ANOMALY_MASTERY"] || 0) + value;
             // Add other potential flat bonuses here (Impact? PEN_VALUE?)
             else { logger.warn(`[parseSetBonus] Unhandled flat stat name: ${name}`); return false; }
             return true;
         }
     }
     return false; // Return false if no match
}


export class PropertyCalculator {
    constructor(characterApiData) { // Input is raw Enka character data object
        // --- Initialize final properties ---
        this.finalHp = 0; this.finalAtk = 0; this.finalDef = 0;
        this.finalCritRatePercent = 0; this.finalCritDmgPercent = 0; this.finalImpact = 0;
        this.finalAnomalyProficiency = 0; this.finalAnomalyMastery = 0;
        this.finalPhysDmgPercent = 0; this.finalFireDmgPercent = 0; this.finalIceDmgPercent = 0;
        this.finalElecDmgPercent = 0; this.finalEtherDmgPercent = 0;
        this.finalEnergyRegenPercent = 0; this.finalPenValue = 0; this.finalPenRatioPercent = 0;

        // --- Basic Validation ---
        if (!characterApiData) {
             logger.error("[PropertyCalculator] Invalid characterApiData input.");
             return;
        }
        const characterId = characterApiData.Id;
        if (!characterId) {
            logger.error("[PropertyCalculator] characterApiData missing Id.");
            return;
        }

        // --- Load Required Static Data using DataLoader ---
        // !! IMPORTANT: Adjust access paths based on actual Hakush JSON structure !!
        const avatarStaticData = getHakushCharacterData(characterId);
        const driveSetDescriptions = getDriveSetData(); // Provides set descriptions
        const driveLevelMap = getDriveLevelMap();       // Provides drive level scaling

        if (!avatarStaticData || !driveSetDescriptions || !driveLevelMap) {
            logger.error(`[PropertyCalculator] Missing required static data for char ID ${characterId}. Cannot proceed.`);
            return;
        }

        // --- Initialize Base Stats from Hakush Data ---
        // ** ASSUMPTION: Hakush data has a 'Stats' object similar to old format **
        // ** ASSUMPTION: IDs map directly (e.g., '20101' for base crit rate) **
        const baseStats = avatarStaticData.Stats || {}; // Adjust if needed
        const finalStats = {
            // Initialize with 0, will be calculated later based on base+weapon
            HP: 0, ATK: 0, DEF: 0,
            // Initialize directly from Hakush base stats
            CRIT_RATE: Number(baseStats['20101']) || 500,          // 5% default
            CRIT_DMG: Number(baseStats['21101']) || 5000,         // 50% default
            ENERGY_REGEN: Number(baseStats['30501']) || 10000,     // 100% default (10000 internal?) - Check unit/value
            PEN_VALUE: Number(baseStats['23201']) || 0,
            PEN_RATIO: Number(baseStats['23101']) || 0,
            // Damage bonuses usually start at 0
            PHYS_DMG: Number(baseStats['31501']) || 0,
            FIRE_DMG: Number(baseStats['31601']) || 0,
            ICE_DMG: Number(baseStats['31701']) || 0,
            ELEC_DMG: Number(baseStats['31801']) || 0,
            ETHER_DMG: Number(baseStats['31901']) || 0,
        };
        // Base values for HP, ATK, DEF used in final calculation
        const agentBaseStats = {
            // ** ASSUMPTION: Hakush uses these IDs for base values in Stats **
            HP: Number(baseStats['11101']) || 0,
            ATK: Number(baseStats['12101']) || 0,
            DEF: Number(baseStats['13101']) || 0,
            IMPACT: Number(baseStats['12201']) || 0,
            ANOMALY_PROFICIENCY: Number(baseStats['31201']) || 0,
            ANOMALY_MASTERY: Number(baseStats['31401']) || 0,
        };

        // --- Apply Level Scaling ---
        const level = characterApiData.Level || 1;
        // ** ASSUMPTION: Hakush has growth values like HpGrowth, AttackGrowth etc. in Stats **
        const growthHp = Number(baseStats.HpGrowth) || 0;
        const growthAtk = Number(baseStats.AttackGrowth) || 0;
        const growthDef = Number(baseStats.DefenceGrowth) || 0; // Corrected typo from DefGrowth
        if (level > 1) {
            // Apply growth based on Hakush values (often 10000x)
            agentBaseStats.HP += Math.floor((growthHp * (level - 1)) / 10000);
            agentBaseStats.ATK += Math.floor((growthAtk * (level - 1)) / 10000);
            agentBaseStats.DEF += Math.floor((growthDef * (level - 1)) / 10000);
        }

        // --- Apply Promotion (Breakthrough) Stats ---
        const promotionLevel = characterApiData.PromotionLevel || 0; // Enka: 0-based
        // ** ASSUMPTION: Hakush uses 'Level' object with keys '1' to '6' for promotion data **
        // ** ASSUMPTION: Promotion adds to base stats directly **
        const hakushPromoLevel = promotionLevel + 1; // Convert to Hakush 1-based index
        for (let p = 1; p < hakushPromoLevel; p++) {
            const promoData = avatarStaticData.Level?.[String(p)]; // Access Hakush promotion data
            if (promoData) {
                // ** ASSUMPTION: Hakush promo data uses these IDs **
                agentBaseStats.HP += Number(promoData.HpMax) || 0; // Assuming HpMax is the added base HP
                agentBaseStats.ATK += Number(promoData.Attack) || 0; // Assuming Attack is the added base ATK
                agentBaseStats.DEF += Number(promoData.Defence) || 0; // Assuming Defence is the added base DEF
                // Add other base stats from promotion if present in Hakush data
                agentBaseStats.IMPACT += Number(promoData['12201']) || 0;
                agentBaseStats.ANOMALY_PROFICIENCY += Number(promoData['31201']) || 0;
                agentBaseStats.ANOMALY_MASTERY += Number(promoData['31401']) || 0;
                 // Add special stats directly to finalStats accumulator
                 finalStats.CRIT_RATE += Number(promoData['20101']) || 0;
                 finalStats.CRIT_DMG += Number(promoData['21101']) || 0;
                 finalStats.ENERGY_REGEN += Number(promoData['30501']) || 0;
                 finalStats.PEN_VALUE += Number(promoData['23201']) || 0;
                 finalStats.PEN_RATIO += Number(promoData['23101']) || 0;
            }
        }

        // --- Apply Core Enhancement Stats ---
        const coreEnhancementLevel = characterApiData.CoreSkillEnhancement || 0; // Enka: 0-based? Check Enka structure
        // ** ASSUMPTION: Hakush uses 'Talent' object with keys like 'Core1', 'Core2' or similar **
        // This part needs significant adaptation based on how Hakush stores Core passives.
        // Let's assume a structure like CoreEnhancementProps used before for now.
        // ** Replace this block with actual Hakush Core Passive logic **
        if (coreEnhancementLevel >= 0 && avatarStaticData.CoreEnhancementProps?.[coreEnhancementLevel]) { // Use assumed structure
           const coreEnhancements = avatarStaticData.CoreEnhancementProps[coreEnhancementLevel];
           logger.debug(`[PropertyCalculator] Applying Core Enhancements (Level ${coreEnhancementLevel}):`, coreEnhancements);
           // Add base stats
           agentBaseStats.HP += Number(coreEnhancements['11101']) || 0;
           agentBaseStats.ATK += Number(coreEnhancements['12101']) || 0;
           agentBaseStats.DEF += Number(coreEnhancements['13101']) || 0;
           agentBaseStats.IMPACT += Number(coreEnhancements['12201']) || 0;
           agentBaseStats.ANOMALY_PROFICIENCY += Number(coreEnhancements['31201']) || 0;
           agentBaseStats.ANOMALY_MASTERY += Number(coreEnhancements['31401']) || 0;
           // Add special stats
           finalStats.CRIT_RATE += Number(coreEnhancements['20101']) || 0;
           finalStats.CRIT_DMG += Number(coreEnhancements['21101']) || 0; // Handle core passive crit dmg
           finalStats.ENERGY_REGEN += Number(coreEnhancements['30501']) || 0;
           finalStats.PEN_VALUE += Number(coreEnhancements['23201']) || 0;
           finalStats.PEN_RATIO += Number(coreEnhancements['23101']) || 0;
           // Add potential damage bonuses from cores if applicable
           finalStats.PHYS_DMG += Number(coreEnhancements['31501'] || coreEnhancements['31503']) || 0; // Check IDs
           finalStats.FIRE_DMG += Number(coreEnhancements['31601'] || coreEnhancements['31603']) || 0;
           finalStats.ICE_DMG += Number(coreEnhancements['31701'] || coreEnhancements['31703']) || 0;
           finalStats.ELEC_DMG += Number(coreEnhancements['31801'] || coreEnhancements['31803']) || 0;
           finalStats.ETHER_DMG += Number(coreEnhancements['31901'] || coreEnhancements['31903']) || 0;
        }

        // --- Initialize Accumulators ---
        const percentAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0 /* Add others if they have % */ };
        const flatAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0 /* Add others */ };

        // --- Process Weapon ---
        let weaponBaseAtk = 0;
        const weaponApiData = characterApiData.Weapon;
        if (weaponApiData?.Id) {
           const weaponStaticData = getHakushWeaponData(weaponApiData.Id); // Use DataLoader
           if (weaponStaticData) {
               const weaponLevel = weaponApiData.Level || 1;
               const weaponBreakLevel = weaponApiData.BreakLevel || 0; // Enka: 0-based

               // ** ASSUMPTION: Hakush weapon structure for level/star scaling and properties **
               const levelScalingData = weaponStaticData.Level?.[String(weaponLevel)];
               const starScalingData = weaponStaticData.Stars?.[String(weaponBreakLevel)];
               const weaponMainStatBase = Number(weaponStaticData.BaseProperty?.Value) || 0;

               if (levelScalingData && starScalingData) {
                   // Calculate weapon base ATK (assuming main stat is ATK, ID 12101)
                   // ** This assumes weapon main stat *always* contributes to base ATK **
                   // ** Need verification if weapon main stat can be HP/DEF **
                   // ** ASSUMPTION: Hakush uses 'Rate' and 'StarRate' for main stat scaling **
                   const mainLevelRate = Number(levelScalingData.Rate) || 0;
                   const mainStarRate = Number(starScalingData.StarRate) || 0;
                   weaponBaseAtk = Math.floor(weaponMainStatBase * (1 + (mainLevelRate + mainStarRate) / 10000));

                   // Process weapon secondary/random stat
                   if (weaponStaticData.RandProperty?.Id && weaponStaticData.RandProperty?.Value) {
                       const secondaryPropId = weaponStaticData.RandProperty.Id;
                       const secondaryPropBaseValue = Number(weaponStaticData.RandProperty.Value) || 0;
                       // ** ASSUMPTION: Hakush uses 'RandRate' for secondary scaling **
                       const randStarRate = Number(starScalingData.RandRate) || 0;
                       const secondaryStatCalculated = Math.floor(secondaryPropBaseValue * (1 + randStarRate / 10000));

                       const propInfo = getPropInfo(secondaryPropId); // Use local getPropInfo
                       const enName = ID_TO_EN[secondaryPropId]; // Get EN name for accumulators

                       // Add to correct accumulator based on type
                       if (propInfo.type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) {
                           flatAdds[enName.replace('_FLAT', '')] += secondaryStatCalculated;
                       } else if (propInfo.type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) {
                           percentAdds[enName.replace('%', '')] += secondaryStatCalculated;
                       } else if (propInfo.type === 'special_percent' && finalStats[enName] !== undefined) {
                           finalStats[enName] += secondaryStatCalculated;
                       } else if (propInfo.type === 'other_flat' && agentBaseStats[enName?.replace('_BASE', '')] !== undefined) {
                           // Other flat stats from weapon add to the base value pool? Needs confirmation.
                           // Or add to flatAdds? Let's add to flatAdds for consistency.
                           flatAdds[enName.replace('_BASE', '')] = (flatAdds[enName.replace('_BASE', '')] || 0) + secondaryStatCalculated;
                           logger.debug(`[PropertyCalculator] Weapon secondary (other_flat) ID ${secondaryPropId} added to flatAdds.${enName.replace('_BASE', '')}`);
                       } else {
                           logger.warn(`[PropertyCalculator] Unhandled weapon secondary stat type: ${propInfo.type} or EN Name: ${enName} for ID ${secondaryPropId}`);
                       }
                   }
               } else {
                   logger.warn(`[PropertyCalculator] Missing level/star scaling data for weapon ${weaponApiData.Id}. Using base ATK only.`);
                   weaponBaseAtk = Math.floor(weaponMainStatBase);
               }
           }
        }
        // Final Base ATK calculation
        const totalBaseAtk = agentBaseStats.ATK + weaponBaseAtk;

        // --- Process Equipment (Drives) ---
        const equippedSetCounts = {};
        const setBonusDescStore = {}; // Store desc2 for later conditional parsing
        const driveLevelMapData = getDriveLevelMap(); // Get pre-processed map

        (characterApiData.EquippedList || []).forEach((item) => {
           if (!item?.Equipment) return;
           const disc = item.Equipment;
           const discId = disc.Id;
           const discLevel = disc.Level || 0;
           const discApiRarity = disc.Rarity || Math.floor(discId / 10000); // Use Rarity field if exists, else derive
           const setBaseId = Math.floor(discId / 100) * 100;

           equippedSetCounts[setBaseId] = (equippedSetCounts[setBaseId] || 0) + 1;

           // --- Process Main Stat ---
           if (disc.MainPropertyList?.[0]) {
               const mainProp = disc.MainPropertyList[0];
               const mainPropId = mainProp.PropertyId;
               const mainStatBaseValue = Number(mainProp.PropertyValue) || 0;

               // Get scaling factor from driveLevelMapData
               // ** ASSUMPTION: discLevelMapData uses Rarity field from Enka **
               const levelData = driveLevelMapData[discApiRarity]?.[discLevel];
               // ** ASSUMPTION: Hakush uses HFGGMPPIKOG for scaling factor **
               const scalingFactor = levelData ? (Number(levelData.HFGGMPPIKOG) || 0) : 0;
               const mainStatValue = Math.floor(mainStatBaseValue * (1 + scalingFactor / 10000));

               const propInfo = getPropInfo(mainPropId);
               const enName = ID_TO_EN[mainPropId];

               // Add to correct accumulator
               if (propInfo.type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) {
                    flatAdds[enName.replace('_FLAT', '')] += mainStatValue;
               } else if (propInfo.type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) {
                    percentAdds[enName.replace('%', '')] += mainStatValue;
               } else if (propInfo.type === 'special_percent' && finalStats[enName] !== undefined) {
                    finalStats[enName] += mainStatValue;
               } else if (propInfo.type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) {
                   // Add other flat stats like Impact, Anomaly Mastery/Proficiency to flatAdds
                   flatAdds[enName.replace('_BASE', '')] = (flatAdds[enName.replace('_BASE', '')] || 0) + mainStatValue;
               } else {
                   logger.warn(`[PropertyCalculator] Unhandled disc main stat type: ${propInfo.type} or EN Name: ${enName} for ID ${mainPropId}`);
               }
           }

           // --- Process Substats ---
           (disc.RandomPropertyList || []).forEach(subProp => {
               const subPropId = subProp.PropertyId;
               // ** ASSUMPTION: Enka PropertyValue for substats is the TOTAL value, not value per roll **
               // ** If PropertyValue IS per roll, need: subStatValue = (Number(subProp.PropertyValue) || 0) * (Number(subProp.PropertyLevel) || 1) **
               const subStatValue = Number(subProp.PropertyValue) || 0; // Assume total value

               const propInfo = getPropInfo(subPropId);
               const enName = ID_TO_EN[subPropId];

               // Add to correct accumulator
               if (propInfo.type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) {
                    flatAdds[enName.replace('_FLAT', '')] += subStatValue;
               } else if (propInfo.type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) {
                    percentAdds[enName.replace('%', '')] += subStatValue;
               } else if (propInfo.type === 'special_percent' && finalStats[enName] !== undefined) {
                    // Log the addition for crit rate debugging
                   if (enName === 'CRIT_RATE') {
                       logger.debug(`[PropertyCalculator] Adding CRIT_RATE substat: +${subStatValue}. Current: ${finalStats.CRIT_RATE}, After: ${finalStats.CRIT_RATE + subStatValue}`);
                   }
                   finalStats[enName] += subStatValue;
               } else if (propInfo.type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) {
                   flatAdds[enName.replace('_BASE', '')] = (flatAdds[enName.replace('_BASE', '')] || 0) + subStatValue;
               } else {
                    logger.warn(`[PropertyCalculator] Unhandled disc sub stat type: ${propInfo.type} or EN Name: ${enName} for ID ${subPropId}`);
               }
           });
        });

        // --- Process Set Bonuses ---
        const setBonusesAccumulated = { flat: {}, percent: {}, other: {} };
        const driveSetData = getDriveSetData(); // Use DataLoader

        for (const setIdStr in equippedSetCounts) {
           const setId = parseInt(setIdStr, 10);
           const count = equippedSetCounts[setId];
           const setData = driveSetData[setId]; // Get set data using ID
           if (!setData) {
               logger.warn(`[PropertyCalculator] Drive set data not found for ID: ${setId}`);
               continue;
           }
           // Parse 2-piece bonus
           if (count >= 2 && setData.desc1) {
               // Special handling for set 32700 might still be needed depending on its effect type
               if(setId !== 32700) parseSetBonus(setData.desc1, setBonusesAccumulated);
           }
           // Parse 4-piece bonus (desc1 for 32700, desc2 for others)
           if (count >= 4) {
               if(setId === 32700 && setData.desc1) { // Handle 32700's 4pc effect from desc1
                   setBonusDescStore[setId] = setData.desc1; // Store for conditional check
               } else if (setData.desc2) { // Handle other sets' 4pc from desc2
                   // Check if desc2 contains static bonuses first
                    if (!parseSetBonus(setData.desc2, setBonusesAccumulated)) {
                         // If parseSetBonus didn't handle it (e.g., complex conditional effects), store it
                         setBonusDescStore[setId] = setData.desc2;
                    }
               }
           }
        }

        // --- Apply Conditional Set Bonuses (like 32700) ---
        // Calculate intermediate anomaly mastery for conditional checks
        let currentAnomalyMasteryBase = agentBaseStats.ANOMALY_MASTERY + (flatAdds.ANOMALY_MASTERY || 0);
        let currentAnomalyMasteryPercent = percentAdds.ANOMALY_MASTERY || 0; // Already in 10000x format potentially
        // Check if ANOMALY_MASTERY flat bonus from sets needs adding here before calc
        currentAnomalyMasteryBase += (setBonusesAccumulated.flat.ANOMALY_MASTERY || 0);
        // Check if ANOMALY_MASTERY percent bonus from sets needs adding here before calc (convert if needed)
        currentAnomalyMasteryPercent += (setBonusesAccumulated.percent["ANOMALY_MASTERY%"] || 0) * 10000; // Ensure 10000x format

        let intermediateAnomalyMastery = Math.floor(currentAnomalyMasteryBase * (1 + currentAnomalyMasteryPercent / 10000));

        for (const setIdStr in setBonusDescStore) {
           const setId = parseInt(setIdStr, 10);
           const desc = setBonusDescStore[setId];
           if (setId === 32700) { // Specific logic for Set ID 32700 (Woodpecker)
               if (intermediateAnomalyMastery >= 115) { // Check condition
                   // Attempt to parse the conditional bonuses from its description
                   parseSetBonus(desc, setBonusesAccumulated); // Let parseSetBonus handle "暴击率提升X%" and "暴击伤害提升Y%"
               }
           }
           // Add specific logic for other conditional sets here if needed
            // Example: Chaos Metal (32300) static bonus is handled below now
        }

        // --- Add Static Chaos Metal 4pc Bonus ---
        // Moved the check outside the loop to apply it once if active
        if (equippedSetCounts[32300] && equippedSetCounts[32300] >= 4) {
            logger.debug('[PropertyCalculator] Applying Chaos Metal 4pc static +20% Crit Damage bonus.');
            // Add directly to the finalStats accumulator
            finalStats.CRIT_DMG += 2000; // 20% = 2000 internal value
        }

        // --- Aggregate All Bonuses ---
        // Combine flat bonuses from sets into the main flatAdds accumulator
        for (const key in setBonusesAccumulated.flat) {
            flatAdds[key] = (flatAdds[key] || 0) + setBonusesAccumulated.flat[key];
        }

        // Add percent bonuses from sets to the main percentAdds accumulator (ensure 10000x format)
        percentAdds.HP += (setBonusesAccumulated.percent['HP%'] || 0) * 10000;
        percentAdds.ATK += (setBonusesAccumulated.percent['ATK%'] || 0) * 10000;
        percentAdds.DEF += (setBonusesAccumulated.percent['DEF%'] || 0) * 10000;
        percentAdds.ANOMALY_MASTERY += (setBonusesAccumulated.percent['ANOMALY_MASTERY%'] || 0) * 10000;
        percentAdds.IMPACT += (setBonusesAccumulated.percent['IMPACT%'] || 0) * 10000;
        percentAdds.ENERGY_REGEN += (setBonusesAccumulated.percent['ENERGY_REGEN%'] || 0) * 10000;

        // Add special percent bonuses from sets to the finalStats accumulator (ensure 10000x format)
        finalStats.CRIT_RATE += (setBonusesAccumulated.percent['CRIT_RATE'] || 0) * 10000;
        finalStats.CRIT_DMG += (setBonusesAccumulated.percent['CRIT_DMG'] || 0) * 10000; // Note: Chaos Metal static added earlier
        finalStats.PHYS_DMG += (setBonusesAccumulated.percent['PHYS_DMG'] || 0) * 10000;
        finalStats.FIRE_DMG += (setBonusesAccumulated.percent['FIRE_DMG'] || 0) * 10000;
        finalStats.ICE_DMG += (setBonusesAccumulated.percent['ICE_DMG'] || 0) * 10000;
        finalStats.ELEC_DMG += (setBonusesAccumulated.percent['ELEC_DMG'] || 0) * 10000;
        finalStats.ETHER_DMG += (setBonusesAccumulated.percent['ETHER_DMG'] || 0) * 10000;
        finalStats.PEN_RATIO += (setBonusesAccumulated.percent['PEN_RATIO'] || 0) * 10000;

        // Add flat anomaly proficiency from sets (if any) back to agentBaseStats for final calc? Or keep in flatAdds?
        // Keeping consistent: add to flatAdds
        flatAdds.ANOMALY_PROFICIENCY = (flatAdds.ANOMALY_PROFICIENCY || 0) + (setBonusesAccumulated.flat.ANOMALY_PROFICIENCY || 0);

        // --- Final Calculations ---
        // HP = (BaseHP_Char * (1 + HP%)) + FlatHP
        this.finalHp = Math.floor(agentBaseStats.HP * (1 + (percentAdds.HP || 0) / 10000) + (flatAdds.HP || 0));
        // ATK = ((BaseATK_Char + BaseATK_Weapon) * (1 + ATK%)) + FlatATK
        this.finalAtk = Math.floor(totalBaseAtk * (1 + (percentAdds.ATK || 0) / 10000) + (flatAdds.ATK || 0));
        // DEF = (BaseDEF_Char * (1 + DEF%)) + FlatDEF
        this.finalDef = Math.floor(agentBaseStats.DEF * (1 + (percentAdds.DEF || 0) / 10000) + (flatAdds.DEF || 0));
        // Impact = BaseImpact_Char * (1 + Impact%) + FlatImpact
        this.finalImpact = Math.floor(agentBaseStats.IMPACT * (1 + (percentAdds.IMPACT || 0) / 10000) + (flatAdds.IMPACT || 0));
        // Anomaly Proficiency = BaseProf_Char + FlatProf
        this.finalAnomalyProficiency = Math.floor(agentBaseStats.ANOMALY_PROFICIENCY + (flatAdds.ANOMALY_PROFICIENCY || 0));
        // Anomaly Mastery = BaseMastery_Char * (1 + Mastery%) + FlatMastery
        this.finalAnomalyMastery = Math.floor(agentBaseStats.ANOMALY_MASTERY * (1 + (percentAdds.ANOMALY_MASTERY || 0) / 10000) + (flatAdds.ANOMALY_MASTERY || 0));

        // Assign accumulated special stats
        logger.debug(`[PropertyCalculator] Final raw CRIT_RATE before assignment: ${finalStats.CRIT_RATE}`);
        this.finalCritRatePercent = finalStats.CRIT_RATE; // This should include base, core, weapon, drives, sets
        this.finalCritDmgPercent = finalStats.CRIT_DMG;
        this.finalPhysDmgPercent = finalStats.PHYS_DMG;
        this.finalFireDmgPercent = finalStats.FIRE_DMG;
        this.finalIceDmgPercent = finalStats.ICE_DMG;
        this.finalElecDmgPercent = finalStats.ELEC_DMG;
        this.finalEtherDmgPercent = finalStats.ETHER_DMG;
        // Energy Regen = BaseEnergyRegen * (1 + EnergyRegen%) + FlatEnergyRegen
        // Assuming ENERGY_REGEN% comes from percentAdds, ENERGY_REGEN from flatAdds
        this.finalEnergyRegenPercent = Math.floor(finalStats.ENERGY_REGEN * (1 + (percentAdds.ENERGY_REGEN || 0) / 10000) + (flatAdds.ENERGY_REGEN || 0) ); // Check if ENERGY_REGEN in finalStats is the base?
        this.finalPenValue = finalStats.PEN_VALUE + (flatAdds.PEN_VALUE || 0); // Assuming PEN_VALUE is flat additive
        this.finalPenRatioPercent = finalStats.PEN_RATIO; // Assuming PEN_RATIO is special percent additive

        logger.info(`[PropertyCalculator] Calculation finished for ${characterId}. CritRateRaw: ${this.finalCritRatePercent}, CritDmgRaw: ${this.finalCritDmgPercent}`);
    }

    // --- Formatting Methods (Keep as is) ---
    _formatValue(value, isPercent, decimals = 1) { // Removed unused isRate
        const numericValue = Number(value);
        if (isNaN(numericValue)) {
            return isPercent ? `0.${'0'.repeat(decimals)}%` : '0';
        }
        if (isPercent) {
             // Assume internal value is 100x for % display (e.g., 500 -> 5.0%)
            return (numericValue / 100).toFixed(decimals) + '%';
        } else {
            return String(Math.floor(numericValue));
        }
    }

    // Formatters using internal _formatValue
    getFormattedHpMax() { return this._formatValue(this.finalHp, false); }
    getFormattedAttack() { return this._formatValue(this.finalAtk, false); }
    getFormattedDefence() { return this._formatValue(this.finalDef, false); }
    getFormattedBreakStun() { return this._formatValue(this.finalImpact, false); }
    getFormattedCrit() { return this._formatValue(this.finalCritRatePercent, true, 1); }
    getFormattedCritDmg() { return this._formatValue(this.finalCritDmgPercent, true, 1); }
    getFormattedElementAbnormalPower() { return this._formatValue(this.finalAnomalyProficiency, false); } // Renamed from Power -> Proficiency
    getFormattedElementMystery() { return this._formatValue(this.finalAnomalyMastery, false); }      // Renamed from Mystery -> Mastery
    getFormattedPenRate() { return this._formatValue(this.finalPenRatioPercent, true, 1); }
    // Energy Regen needs clarification on unit and base value (10000 = 100%? 120 = 1.2/s?)
    // Formatting based on MYS standard (percent efficiency)
    getFormattedSpRecoverPercent() { return this._formatValue(this.finalEnergyRegenPercent, true, 1); }
    getFormattedPenDelta() { return this._formatValue(this.finalPenValue, false); }
    getFormattedPhysDmgBonus() { return this._formatValue(this.finalPhysDmgPercent, true, 1); }
    getFormattedFireDmgBonus() { return this._formatValue(this.finalFireDmgPercent, true, 1); }
    getFormattedIceDmgBonus() { return this._formatValue(this.finalIceDmgPercent, true, 1); }
    getFormattedThunderDmgBonus() { return this._formatValue(this.finalElecDmgPercent, true, 1); }
    getFormattedEtherDmgBonus() { return this._formatValue(this.finalEtherDmgPercent, true, 1); }
}
