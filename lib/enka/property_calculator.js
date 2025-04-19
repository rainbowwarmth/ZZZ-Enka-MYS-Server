// property_calculator.js (Refactored & Fixed based on Hakush data analysis and Log errors)

import _ from 'lodash';
// --- Import Data Loaders and Constants ---
import {
    getHakushCharacterData,
    getHakushWeaponData,
    getDriveSetData,      // Provides descriptions for set bonuses
    getDriveLevelMap      // Provides drive level scaling data
} from './data_loader.js'; // Adjust path as needed
// Import necessary constants AND the new config/getter
import { ID_TO_EN, ID_TO_PROP_NAME, PROP_NAME_TO_ID, PROP_ID_CONFIG, getPropConfig } from './constants.js'; // Adjust path as needed

const logger = console; // Use your project's logger

// --- Set Bonus Parser (Kept as is) ---
function parseSetBonus(desc, targetStatMap) {


    const cleanDesc = desc.replace(/<color=#[0-9A-Fa-f]+>/gi, '').replace(/<\/color>/gi, '');


    const percentMatch = cleanDesc.match(/([\u4e00-\u9fa5\w]+)\s?\+\s?([0-9.]+)\s?%/); // Added optional spaces
    if (percentMatch) {
        const name = percentMatch[1];
        const value = parseFloat(percentMatch[2]);
        if (!isNaN(value)) {
            const fracValue = value / 100; // Convert percentage to fraction
            if (name.includes("暴击率")) targetStatMap.percent["CRIT_RATE"] = (targetStatMap.percent["CRIT_RATE"] || 0) + fracValue;
            else if (name.includes("暴击伤害")) targetStatMap.percent["CRIT_DMG"] = (targetStatMap.percent["CRIT_DMG"] || 0) + fracValue;
            else if (name.includes("攻击力")) targetStatMap.percent["ATK%"] = (targetStatMap.percent["ATK%"] || 0) + fracValue;
            else if (name.includes("防御力")) targetStatMap.percent["DEF%"] = (targetStatMap.percent["DEF%"] || 0) + fracValue;
            else if (name.includes("生命值")) targetStatMap.percent["HP%"] = (targetStatMap.percent["HP%"] || 0) + fracValue;
            else if (name.includes("护盾值")) targetStatMap.percent["SHIELD%"] = (targetStatMap.percent["SHIELD%"] || 0) + fracValue; // Assuming SHIELD% key exists if needed
            else if (name.includes("冲击力")) targetStatMap.percent["IMPACT%"] = (targetStatMap.percent["IMPACT%"] || 0) + fracValue;
            else if (name.includes("穿透率")) targetStatMap.percent["PEN_RATIO"] = (targetStatMap.percent["PEN_RATIO"] || 0) + fracValue;
            else if (name.includes("能量自动回复") || name.includes("能量回复效率")) targetStatMap.percent["ENERGY_REGEN%"] = (targetStatMap.percent["ENERGY_REGEN%"] || 0) + fracValue; // Handle both terms for efficiency
            else if (name.includes("异常掌控")) targetStatMap.percent["ANOMALY_MASTERY%"] = (targetStatMap.percent["ANOMALY_MASTERY%"] || 0) + fracValue;
            else if (name.includes("物理伤害")) targetStatMap.percent["PHYS_DMG"] = (targetStatMap.percent["PHYS_DMG"] || 0) + fracValue;
            else if (name.includes("火属性伤害")) targetStatMap.percent["FIRE_DMG"] = (targetStatMap.percent["FIRE_DMG"] || 0) + fracValue;
            else if (name.includes("冰属性伤害")) targetStatMap.percent["ICE_DMG"] = (targetStatMap.percent["ICE_DMG"] || 0) + fracValue;
            else if (name.includes("电属性伤害") || name.includes("雷属性伤害")) targetStatMap.percent["ELEC_DMG"] = (targetStatMap.percent["ELEC_DMG"] || 0) + fracValue;
            else if (name.includes("以太伤害")) targetStatMap.percent["ETHER_DMG"] = (targetStatMap.percent["ETHER_DMG"] || 0) + fracValue;
            logger.debug(`[parseSetBonus] Parsed percent bonus: ${name} + ${value}% -> ETHER_DMG`);
            return true;
        }

        return true;
    }



const flatMatch = cleanDesc.match(/([\u4e00-\u9fa5\w]+)\s?\+\s?([0-9.]+)\s?点?/);
    if (flatMatch) {
        const name = flatMatch[1]; const value = parseFloat(flatMatch[2]);
        if (!isNaN(value)) {
            if (name.includes("异常精通")) targetStatMap.flat["ANOMALY_PROFICIENCY"] = (targetStatMap.flat["ANOMALY_PROFICIENCY"] || 0) + value;
            else if (name.includes("异常掌控")) targetStatMap.flat["ANOMALY_MASTERY"] = (targetStatMap.flat["ANOMALY_MASTERY"] || 0) + value;
            else if (name.includes("冲击力")) targetStatMap.flat["IMPACT"] = (targetStatMap.flat["IMPACT"] || 0) + value;
            else if (name.includes("穿透值")) targetStatMap.flat["PEN_VALUE"] = (targetStatMap.flat["PEN_VALUE"] || 0) + value;
            else { logger.warn(`[parseSetBonus] Unhandled flat stat name: ${name}`) }
             logger.debug(`[parseSetBonus] Parsed flat bonus: ${name} + ${value}`);

        }


}}


export class PropertyCalculator {
    constructor(characterApiData) {
        // --- Initialize final properties ---
        this.finalHp = 0; this.finalAtk = 0; this.finalDef = 0;
        this.finalCritRatePercent = 0; this.finalCritDmgPercent = 0; this.finalImpact = 0;
        this.finalAnomalyProficiency = 0; this.finalAnomalyMastery = 0;
        this.finalPhysDmgPercent = 0; this.finalFireDmgPercent = 0; this.finalIceDmgPercent = 0;
        this.finalElecDmgPercent = 0; this.finalEtherDmgPercent = 0;
        this.finalEnergyRegenPercent = 0; this.finalPenValue = 0; this.finalPenRatioPercent = 0;
        this.finalEnergyRegenRate = 0
        // --- Basic Validation ---
        if (!characterApiData) { logger.error("[PropertyCalculator] Invalid characterApiData input."); return; }
        const characterId = characterApiData.Id;
        if (!characterId) { logger.error("[PropertyCalculator] characterApiData missing Id."); return; }

        // --- Load Required Static Data using DataLoader ---
        const avatarStaticData = getHakushCharacterData(characterId);
        const driveSetDescriptions = getDriveSetData();
        const driveLevelMap = getDriveLevelMap();

        if (!avatarStaticData || !driveSetDescriptions || !driveLevelMap) {
            logger.error(`[PropertyCalculator] Missing required static data for char ID ${characterId}. Cannot proceed.`);
            return;
        }

        // --- Initialize Base Stats from Hakush Data ('Stats' object) ---
        const baseStats = avatarStaticData.Stats || {};
        logger.debug(`[PropertyCalculator][${characterId}] Base Stats from Hakush:`, baseStats);
        const finalStatsAccumulator = { // Stores special percent stats and damage bonuses
            CRIT_RATE: Number(baseStats['Crit']) || 500,
            CRIT_DMG: Number(baseStats['CritDamage']) || 5000,
            ENERGY_REGEN: Number(baseStats['SpRecover']) || 10000,
            PEN_VALUE: Number(baseStats['PenDelta']) || 0,
            PEN_RATIO: Number(baseStats['PenRate']) || 0,
            PHYS_DMG: 0, FIRE_DMG: 0, ICE_DMG: 0, ELEC_DMG: 0, ETHER_DMG: 0,
        };
        const agentBaseStats = { // Stores base values for HP/ATK/DEF and other flat stats that scale with percentages
            HP: Number(baseStats['HpMax']) || 0,
            ATK: Number(baseStats['Attack']) || 0,
            DEF: Number(baseStats['Defence']) || 0,
            IMPACT: Number(baseStats['BreakStun']) || 0,
            ANOMALY_PROFICIENCY: Number(baseStats['ElementMystery']) || 0,
            ANOMALY_MASTERY: Number(baseStats['ElementAbnormalPower']) || 0,
            ENERGY_REGEN_RATE: Number(baseStats['SpRecover']) || 0,
        };
        logger.debug(`[PropertyCalculator][${characterId}] Initial agentBaseStats:`, agentBaseStats);
        logger.debug(`[PropertyCalculator][${characterId}] Initial finalStatsAccumulator (special):`, finalStatsAccumulator);

        // --- Apply Level Scaling ---
        const level = characterApiData.Level || 1;
        const growthHp = Number(baseStats.HpGrowth) || 0;
        const growthAtk = Number(baseStats.AttackGrowth) || 0;
        const growthDef = Number(baseStats.DefenceGrowth) || 0;
        if (level > 1) {
            agentBaseStats.HP += Math.floor((growthHp * (level - 1)) / 10000);
            agentBaseStats.ATK += Math.floor((growthAtk * (level - 1)) / 10000);
            agentBaseStats.DEF += Math.floor((growthDef * (level - 1)) / 10000);
        }
        logger.debug(`[PropertyCalculator][${characterId}] After Level ${level} Scaling agentBaseStats:`, agentBaseStats);

        // --- Apply Promotion (Breakthrough) Stats ---
        const promotionLevel = characterApiData.PromotionLevel || 0; // Enka: 0-based
        const hakushMaxPromoKey = promotionLevel + 1;
        for (let p = 2; p <= hakushMaxPromoKey; p++) { // Loop starts from key "2" (1st promo stats)
            const promoData = avatarStaticData.Level?.[String(p)];
            if (promoData) {
                logger.debug(`[PropertyCalculator][${characterId}] Applying Promotion Hakush Key ${p} Data:`, promoData);
                agentBaseStats.HP += Number(promoData.HpMax) || 0;
                agentBaseStats.ATK += Number(promoData.Attack) || 0;
                agentBaseStats.DEF += Number(promoData.Defence) || 0;
                // Add other base stats if present in Hakush Level data
                agentBaseStats.IMPACT += Number(promoData['12201']) || 0;
                agentBaseStats.ANOMALY_PROFICIENCY += Number(promoData['31201']) || 0;
                agentBaseStats.ANOMALY_MASTERY += Number(promoData['31401']) || 0;
            }
        }
        logger.debug(`[PropertyCalculator][${characterId}] After Promotion Level ${promotionLevel} agentBaseStats:`, agentBaseStats);

        // --- Initialize Accumulators ---
        const percentAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0 };
        const flatAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0, ANOMALY_PROFICIENCY: 0, PEN_VALUE: 0 ,ENERGY_REGEN_RATE: 0};

        // --- Apply Core Enhancement Stats ---
        const coreEnhancementLevel = characterApiData.CoreSkillEnhancement || 0;
        const hakushExtraLevelKey = String(coreEnhancementLevel); // Assuming direct map for now

        if (hakushExtraLevelKey !== '0' && avatarStaticData.ExtraLevel?.[hakushExtraLevelKey]?.Extra) {
             const coreEnhancements = avatarStaticData.ExtraLevel[hakushExtraLevelKey].Extra;
             logger.debug(`[PropertyCalculator][${characterId}] Applying Core Enhancements (Enka Level ${coreEnhancementLevel} -> Hakush Key ${hakushExtraLevelKey}):`, coreEnhancements);

             for (const propIdStr in coreEnhancements) {
                 const propData = coreEnhancements[propIdStr];
                 const coreStatValue = Number(propData.Value) || 0;
                 const config = getPropConfig(propIdStr);
                 const enName = config.en;
                 const type = config.type;

                 if (coreStatValue === 0) continue;
                 logger.debug(`[PropertyCalculator][${characterId}] Core Stat ID: ${propIdStr}, Value: ${coreStatValue}, Type: ${type}, EN: ${enName}`);

                 // *** FIXED: Apply core 'base' stats to flatAdds ***
                 if (type === 'base' && flatAdds[enName?.replace('_BASE', '')] !== undefined) {
                      flatAdds[enName.replace('_BASE', '')] += coreStatValue;
                      logger.debug(`[PropertyCalculator][${characterId}] Adding core base stat ${propIdStr} to flatAdds.${enName.replace('_BASE', '')}`);
                 } else if (type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) {
                      flatAdds[enName.replace('_FLAT', '')] += coreStatValue;
                 } else if (type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) {
                      percentAdds[enName.replace('%', '')] += coreStatValue;
                 } else if (type === 'special_percent' && finalStatsAccumulator[enName?.replace('_BASE', '')] !== undefined) {
                      const targetKey = enName.replace('_BASE', '');
                      const beforeAdd = finalStatsAccumulator[targetKey];
                      finalStatsAccumulator[targetKey] += coreStatValue;
                      logger.debug(`[PropertyCalculator][${characterId}] Adding special core stat ${targetKey}: +${coreStatValue}. Before: ${beforeAdd}, After: ${finalStatsAccumulator[targetKey]}`);
                 } else if (type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) {
                      flatAdds[enName.replace('_BASE', '')] = (flatAdds[enName.replace('_BASE', '')] || 0) + coreStatValue;
                 } else {
                      logger.warn(`[PropertyCalculator][${characterId}] Unhandled core stat type: ${type} or EN Name: ${enName} for ID ${propIdStr}`);
                 }
             }
             logger.debug(`[PropertyCalculator][${characterId}] After Core - finalStatsAccumulator:`, finalStatsAccumulator);
             logger.debug(`[PropertyCalculator][${characterId}] After Core - flatAdds:`, flatAdds);
             logger.debug(`[PropertyCalculator][${characterId}] After Core - percentAdds:`, percentAdds);
        } else {
            logger.debug(`[PropertyCalculator][${characterId}] No core enhancements found for Enka Level ${coreEnhancementLevel} (Hakush Key ${hakushExtraLevelKey})`);
        }

        // --- Process Weapon ---
        let weaponBaseAtk = 0;
        const weaponApiData = characterApiData.Weapon;
        if (weaponApiData?.Id) {
           const weaponStaticData = getHakushWeaponData(weaponApiData.Id);
           if (weaponStaticData) {
               const weaponLevel = weaponApiData.Level || 1;
               const weaponBreakLevel = weaponApiData.BreakLevel || 0;
               const levelScalingData = weaponStaticData.Level?.[String(weaponLevel)];
               const starScalingData = weaponStaticData.Stars?.[String(weaponBreakLevel)];
               const weaponMainStatBase = Number(weaponStaticData.BaseProperty?.Value) || 0;

               if (levelScalingData && starScalingData) {
                   const mainLevelRate = Number(levelScalingData.Rate) || 0;
                   const mainStarRate = Number(starScalingData.StarRate) || 0;
                   weaponBaseAtk = Math.floor(weaponMainStatBase * (1 + (mainLevelRate + mainStarRate) / 10000));

                   const secondaryPropName = weaponStaticData.RandProperty?.Name2;
                   const secondaryPropId = secondaryPropName ? PROP_NAME_TO_ID[secondaryPropName] : null;
                   const secondaryPropBaseValue = Number(weaponStaticData.RandProperty?.Value) || 0;

                   if (secondaryPropId && secondaryPropBaseValue > 0) {
                       const randStarRate = Number(starScalingData.RandRate) || 0;
                       const secondaryStatCalculated = Math.floor(secondaryPropBaseValue * (1 + randStarRate / 10000));
                       const config = getPropConfig(secondaryPropId);
                       const enName = config.en;
                       const type = config.type;
                       logger.debug(`[PropertyCalculator][${characterId}] Weapon Secondary ID: ${secondaryPropId}, Name: ${secondaryPropName}, Value: ${secondaryStatCalculated}, Type: ${type}, EN: ${enName}`);
                       if (type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) flatAdds[enName.replace('_FLAT', '')] += secondaryStatCalculated;
                       else if (type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) percentAdds[enName.replace('%', '')] += secondaryStatCalculated;
                       else if (type === 'special_percent' && finalStatsAccumulator[enName?.replace('_BASE', '')] !== undefined) finalStatsAccumulator[enName.replace('_BASE', '')] += secondaryStatCalculated;
                       else if (type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) flatAdds[enName.replace('_BASE', '')] += secondaryStatCalculated;
                       else logger.warn(`[PropertyCalculator][${characterId}] Unhandled weapon secondary stat type: ${type} or EN Name: ${enName} for ID ${secondaryPropId}`);
                   }
               } else {
                   logger.warn(`[PropertyCalculator][${characterId}] Missing level/star scaling data for weapon ${weaponApiData.Id}. Using base ATK only.`);
                   weaponBaseAtk = Math.floor(weaponMainStatBase);
               }
           }
        }
        const totalBaseAtk = agentBaseStats.ATK + weaponBaseAtk;
        logger.debug(`[PropertyCalculator][${characterId}] Agent Base ATK: ${agentBaseStats.ATK}, Weapon Base ATK: ${weaponBaseAtk}, Total Base ATK: ${totalBaseAtk}`);
        logger.debug(`[PropertyCalculator][${characterId}] After Weapon - flatAdds:`, flatAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Weapon - percentAdds:`, percentAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Weapon - finalStatsAccumulator:`, finalStatsAccumulator);

        // --- Process Equipment (Drives) ---
        const equippedSetCounts = {};
        const setBonusDescStore = {};
        const driveLevelMapData = getDriveLevelMap();

        (characterApiData.EquippedList || []).forEach((item) => {
            if (!item?.Equipment) return;
            const disc = item.Equipment;
            const discId = disc.Id;
            const discLevel = disc.Level || 0;

            // *** FIXED: Determine Rarity - Use ID prefix assumption ***
            let derivedRarity;
            const idStr = String(discId);
            if (idStr.startsWith('3')) derivedRarity = 4; // Assume 3xxxx = A (Rarity 4 for lookup)
            else if (idStr.startsWith('4')) derivedRarity = 5; // Assume 4xxxx = S (Rarity 5 for lookup)
            else {
                // Fallback or stricter error if ID doesn't match expected patterns
                // Using Enka Rarity as fallback if derivation fails
                derivedRarity = disc.Rarity;
                if (!derivedRarity) {
                    logger.warn(`[PropertyCalculator][${characterId}] Could not determine Rarity for Drive Disc ${discId} from ID prefix or Enka data. Skipping.`);
                    return; // Skip this disc if rarity unknown
                }
                logger.warn(`[PropertyCalculator][${characterId}] Disc ${discId} rarity derived from Enka data (${derivedRarity}) as ID prefix was not 3 or 4.`);
            }

            const setBaseId = Math.floor(discId / 100) * 100;
            equippedSetCounts[setBaseId] = (equippedSetCounts[setBaseId] || 0) + 1;

            // --- Process Main Stat ---
            if (disc.MainPropertyList?.[0]) {
                const mainProp = disc.MainPropertyList[0];
                const mainPropId = mainProp.PropertyId;
                const mainStatBaseValue = Number(mainProp.PropertyValue) || 0;
                const levelData = driveLevelMapData[derivedRarity]?.[discLevel];
                const scalingFactor = levelData ? (Number(levelData.HFGGMPPIKOG) || 0) : 0;
                const mainStatValue = Math.floor(mainStatBaseValue * (1 + scalingFactor / 10000));
                const config = getPropConfig(mainPropId);
                const enName = config.en;
                const type = config.type;

                logger.debug(`[PropertyCalculator][${characterId}] Drive ${discId} Main Stat ID: ${mainPropId}, FinalVal: ${mainStatValue}, Type: ${type}, EN: ${enName}`);

                if (type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) flatAdds[enName.replace('_FLAT', '')] += mainStatValue;
                else if (type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) percentAdds[enName.replace('%', '')] += mainStatValue;
                else if (type === 'special_percent' && finalStatsAccumulator[enName?.replace('_BASE', '')] !== undefined) finalStatsAccumulator[enName.replace('_BASE', '')] += mainStatValue;
                else if (type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) flatAdds[enName.replace('_BASE', '')] += mainStatValue;
                else logger.warn(`[PropertyCalculator][${characterId}] Unhandled disc main stat type: ${type} or EN Name: ${enName} for ID ${mainPropId}`);
            }

            // --- Process Substats ---
            (disc.RandomPropertyList || []).forEach(subProp => {
                const subPropId = subProp.PropertyId;
                const propLevel = Number(subProp.PropertyLevel) || 1;
                const valuePerRoll = Number(subProp.PropertyValue) || 0;
                const totalSubstatValue = valuePerRoll * propLevel; // *** CORRECTED CALCULATION ***

                if (totalSubstatValue === 0) return;

                const config = getPropConfig(subPropId);
                const enName = config.en;
                const type = config.type;

                logger.debug(`[PropertyCalculator][${characterId}] Drive ${discId} Substat ID: ${subPropId}, Rolls: ${propLevel}, Val/Roll: ${valuePerRoll}, Total: ${totalSubstatValue}, Type: ${type}, EN: ${enName}`);

                if (type === 'flat' && flatAdds[enName?.replace('_FLAT', '')] !== undefined) flatAdds[enName.replace('_FLAT', '')] += totalSubstatValue;
                else if (type === 'percent' && percentAdds[enName?.replace('%', '')] !== undefined) percentAdds[enName.replace('%', '')] += totalSubstatValue;
                else if (type === 'special_percent' && finalStatsAccumulator[enName?.replace('_BASE', '')] !== undefined) {
                     const targetKey = enName.replace('_BASE', '');
                     const beforeAdd = finalStatsAccumulator[targetKey];
                     finalStatsAccumulator[targetKey] += totalSubstatValue;
                     logger.debug(`[PropertyCalculator][${characterId}] Adding special_percent substat ${targetKey}: +${totalSubstatValue}. Before: ${beforeAdd}, After: ${finalStatsAccumulator[targetKey]}`);
                } else if (type === 'other_flat' && flatAdds[enName?.replace('_BASE', '')] !== undefined) {
                     flatAdds[enName.replace('_BASE', '')] += totalSubstatValue;
                } else { logger.warn(`[PropertyCalculator][${characterId}] Unhandled disc sub stat type: ${type} or EN Name: ${enName} for ID ${subPropId}`); }
            });
        });
        logger.debug(`[PropertyCalculator][${characterId}] After Drives - flatAdds:`, flatAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Drives - percentAdds:`, percentAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Drives - finalStatsAccumulator (special):`, finalStatsAccumulator);


        // --- Process Set Bonuses ---
        const setBonusesAccumulated = { flat: {}, percent: {}, other: {} };
        const driveSetData = getDriveSetData();

        for (const setIdStr in equippedSetCounts) {
            const setId = parseInt(setIdStr, 10);
            const count = equippedSetCounts[setId];
            const setData = driveSetData[setId];
            if (!setData) { logger.warn(`[PropertyCalculator][${characterId}] Drive set data not found for ID: ${setId}`); continue; }
            if (count >= 2 && setData.desc1) { if(setId !== 32700) parseSetBonus(setData.desc1, setBonusesAccumulated); }
            if (count >= 4) {
                if(setId === 32700 && setData.desc1) { setBonusDescStore[setId] = setData.desc1; }
                else if (setData.desc2) { if (!parseSetBonus(setData.desc2, setBonusesAccumulated)) { setBonusDescStore[setId] = setData.desc2; } }
            }
        }
        logger.debug(`[PropertyCalculator][${characterId}] Parsed Set Bonuses (Before Conditional):`, setBonusesAccumulated);


        // --- Apply Conditional Set Bonuses ---
        // *** FIXED: Declare variables before use ***
        let currentAnomalyMasteryBase = agentBaseStats.ANOMALY_MASTERY + (flatAdds.ANOMALY_MASTERY || 0) + (setBonusesAccumulated.flat.ANOMALY_MASTERY || 0);
        let currentAnomalyMasteryPercent = (percentAdds.ANOMALY_MASTERY || 0) + (setBonusesAccumulated.percent["ANOMALY_MASTERY%"] || 0) * 10000;
        let intermediateAnomalyMastery = Math.floor(currentAnomalyMasteryBase * (1 + currentAnomalyMasteryPercent / 10000));
        logger.debug(`[PropertyCalculator][${characterId}] Intermediate Anomaly Mastery for Conditional Sets: ${intermediateAnomalyMastery}`);

        for (const setIdStr in setBonusDescStore) {
            const setId = parseInt(setIdStr, 10);
            const desc = setBonusDescStore[setId];
            if (setId === 32700) { // Woodpecker
                if (intermediateAnomalyMastery >= 115) {
                    logger.debug(`[PropertyCalculator][${characterId}] Applying conditional Woodpecker (32700) bonus.`);
                    parseSetBonus(desc, setBonusesAccumulated);
                }
            }
             // Add logic for other conditional sets if needed based on desc
        }

        // --- Add Static Chaos Metal 4pc Bonus ---
        // if (equippedSetCounts[32300] && equippedSetCounts[32300] >= 4) {
        //     logger.debug(`[PropertyCalculator][${characterId}] Applying Chaos Metal (32300) 4pc static +20% Crit Damage bonus.`);
        //     finalStatsAccumulator.CRIT_DMG += 2000;
        // }
        logger.debug(`[PropertyCalculator][${characterId}] Parsed Set Bonuses (After Conditional & Static):`, setBonusesAccumulated);


        // --- Aggregate All Set Bonuses ---


        for (const key in setBonusesAccumulated.flat) {
            const flatKey = key.replace('_BASE', '').replace('_FLAT', ''); // Normalize key
            if (flatAdds[flatKey] !== undefined) { flatAdds[flatKey] += setBonusesAccumulated.flat[key]; }
            else { logger.warn(`[PropertyCalculator][${characterId}] Unknown flat set bonus key mapping: ${key} -> ${flatKey}`); }
        }
        // Aggregate percent bonuses (ensure correct target and 10000x format)
        percentAdds.HP += (setBonusesAccumulated.percent['HP%'] || 0) * 10000;
        percentAdds.ATK += (setBonusesAccumulated.percent['ATK%'] || 0) * 10000;
        percentAdds.DEF += (setBonusesAccumulated.percent['DEF%'] || 0) * 10000;
        percentAdds.ANOMALY_MASTERY += (setBonusesAccumulated.percent['ANOMALY_MASTERY%'] || 0) * 10000;
        percentAdds.IMPACT += (setBonusesAccumulated.percent['IMPACT%'] || 0) * 10000;
        percentAdds.ENERGY_REGEN += (setBonusesAccumulated.percent['ENERGY_REGEN%'] || 0) * 10000;


        // Aggregate special percent bonuses (ensure correct target and 10000x format)
        finalStatsAccumulator.CRIT_RATE += (setBonusesAccumulated.percent['CRIT_RATE'] || 0) * 10000;
        finalStatsAccumulator.CRIT_DMG += (setBonusesAccumulated.percent['CRIT_DMG'] || 0) * 10000;
        finalStatsAccumulator.PHYS_DMG += (setBonusesAccumulated.percent['PHYS_DMG'] || 0) * 10000;
        finalStatsAccumulator.FIRE_DMG += (setBonusesAccumulated.percent['FIRE_DMG'] || 0) * 10000;
        finalStatsAccumulator.ICE_DMG += (setBonusesAccumulated.percent['ICE_DMG'] || 0) * 10000;
        finalStatsAccumulator.ELEC_DMG += (setBonusesAccumulated.percent['ELEC_DMG'] || 0) * 10000;
        finalStatsAccumulator.ETHER_DMG += (setBonusesAccumulated.percent['ETHER_DMG'] || 0) * 10000;
        finalStatsAccumulator.PEN_RATIO += (setBonusesAccumulated.percent['PEN_RATIO'] || 0) * 10000;

        logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - flatAdds:`, flatAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - percentAdds:`, percentAdds);
        logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - finalStatsAccumulator:`, finalStatsAccumulator);


        // --- Final Calculations ---
        this.finalHp = Math.floor(agentBaseStats.HP * (1 + (percentAdds.HP || 0) / 10000) + (flatAdds.HP || 0));
        this.finalAtk = Math.floor(totalBaseAtk * (1 + (percentAdds.ATK || 0) / 10000) + (flatAdds.ATK || 0));
        this.finalDef = Math.floor(agentBaseStats.DEF * (1 + (percentAdds.DEF || 0) / 10000) + (flatAdds.DEF || 0));
        this.finalImpact = Math.floor(agentBaseStats.IMPACT * (1 + (percentAdds.IMPACT || 0) / 10000) + (flatAdds.IMPACT || 0));
        this.finalAnomalyProficiency = Math.floor(agentBaseStats.ANOMALY_PROFICIENCY + (flatAdds.ANOMALY_PROFICIENCY || 0));
        this.finalAnomalyMastery = Math.floor(agentBaseStats.ANOMALY_MASTERY * (1 + (percentAdds.ANOMALY_MASTERY || 0) / 10000) + (flatAdds.ANOMALY_MASTERY || 0));

        // Assign final accumulated special stats
        this.finalCritRatePercent = finalStatsAccumulator.CRIT_RATE;
        this.finalCritDmgPercent = finalStatsAccumulator.CRIT_DMG;
        this.finalPhysDmgPercent = finalStatsAccumulator.PHYS_DMG;
        this.finalFireDmgPercent = finalStatsAccumulator.FIRE_DMG;
        this.finalIceDmgPercent = finalStatsAccumulator.ICE_DMG;
        this.finalElecDmgPercent = finalStatsAccumulator.ELEC_DMG;
        this.finalEtherDmgPercent = finalStatsAccumulator.ETHER_DMG;
        // Apply ER% and Flat ER to the base ER (from finalStatsAccumulator)
        this.finalEnergyRegenPercent = Math.floor(finalStatsAccumulator.ENERGY_REGEN * (1 + (percentAdds.ENERGY_REGEN || 0) / 10000) + (flatAdds.ENERGY_REGEN || 0) );
        this.finalPenValue = finalStatsAccumulator.PEN_VALUE + (flatAdds.PEN_VALUE || 0); // Add flat PEN from drives/sets etc.
        this.finalPenRatioPercent = finalStatsAccumulator.PEN_RATIO; // Add PEN Rate% from drives/sets etc.
        this.finalEnergyRegenRate = Math.floor(agentBaseStats.ENERGY_REGEN_RATE + (flatAdds.ENERGY_REGEN_RATE || 0));
        logger.info(`[PropertyCalculator][${characterId}] Calculation finished. Final Raw Values => HP:${this.finalHp} ATK:${this.finalAtk} DEF:${this.finalDef} CritRate:${this.finalCritRatePercent} CritDmg:${this.finalCritDmgPercent} ER:${this.finalEnergyRegenPercent}`);
    }

    // --- Formatting Methods ---
    _formatValue(value, isPercent, decimals = 1) {
        const numericValue = Number(value);
        if (isNaN(numericValue)) { return isPercent ? `0.${'0'.repeat(decimals)}%` : '0'; }
        if (isPercent) { return (numericValue / 100).toFixed(decimals) + '%'; } // Assumes 100x internal value
        else { return String(Math.floor(numericValue)); }
    }
    getFormattedHpMax() { return this._formatValue(this.finalHp, false); }
    getFormattedAttack() { return this._formatValue(this.finalAtk, false); }
    getFormattedDefence() { return this._formatValue(this.finalDef, false); }
    getFormattedBreakStun() { return this._formatValue(this.finalImpact, false); }
    getFormattedCrit() { return this._formatValue(this.finalCritRatePercent, true, 1); }
    getFormattedCritDmg() { return this._formatValue(this.finalCritDmgPercent, true, 1); }
    getFormattedElementAbnormalPower() { return this._formatValue(this.finalAnomalyMastery, false); }
    getFormattedElementMystery() { return this._formatValue(this.finalAnomalyProficiency, false); }
    getFormattedPenRate() { return this._formatValue(this.finalPenRatioPercent, true, 1); }
   getFormattedSpRecoverRate() {return (this.finalEnergyRegenRate / 100).toFixed(1); }

    getFormattedPenDelta() { return this._formatValue(this.finalPenValue, false); }
    getFormattedPhysDmgBonus() { return this._formatValue(this.finalPhysDmgPercent, true, 1); }
    getFormattedFireDmgBonus() { return this._formatValue(this.finalFireDmgPercent, true, 1); }
    getFormattedIceDmgBonus() { return this._formatValue(this.finalIceDmgPercent, true, 1); }
    getFormattedThunderDmgBonus() { return this._formatValue(this.finalElecDmgPercent, true, 1); }
    getFormattedEtherDmgBonus() { return this._formatValue(this.finalEtherDmgPercent, true, 1); }
}
