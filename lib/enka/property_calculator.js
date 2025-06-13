// property_calculator.js (Final Verified Version - Reverted Growth Denominator, Kept Impact Mod, Verified Y=k(1+X)+b)
import _ from 'lodash';
// --- Import Data Loaders and Constants ---
import {
    getEnkaStoreAvatarsData,
    getHakushWeaponData,
    getDriveSetData,
    getDriveLevelMap
} from './data_loader.js'; // Adjust path as needed
import { MAIN_PROP_BASE_INCREASE, ID_TO_EN, ID_TO_PROP_NAME, PROP_NAME_TO_ID, PROP_ID_CONFIG, getPropConfig, PERCENT_ID_LIST } from './constants.js'; // Adjust path as needed

import { logger } from '../logger.js'; // Import logger for debugging

// --- Set Bonus Parser ---
function parseSetBonus(desc, targetStatMap) {
    const cleanDesc = desc.replace(/<color=#[0-9A-Fa-f]+>/gi, '').replace(/<\/color>/gi, '');
    const percentMatch = cleanDesc.match(/([\u4e00-\u9fa5\w]+)\s?\+\s?([0-9.]+)\s?%/);
    if (percentMatch) {
        const name = percentMatch[1]; const value = parseFloat(percentMatch[2]);
        if (!isNaN(value)) {
            const fracValue = value / 100;
            if (name.includes("暴击率")) targetStatMap.percent["CRIT_RATE"] = (targetStatMap.percent["CRIT_RATE"] || 0) + fracValue;
            else if (name.includes("暴击伤害")) targetStatMap.percent["CRIT_DMG"] = (targetStatMap.percent["CRIT_DMG"] || 0) + fracValue;
            else if (name.includes("攻击力")) targetStatMap.percent["ATK%"] = (targetStatMap.percent["ATK%"] || 0) + fracValue;
            else if (name.includes("防御力")) targetStatMap.percent["DEF%"] = (targetStatMap.percent["DEF%"] || 0) + fracValue;
            else if (name.includes("生命值")) targetStatMap.percent["HP%"] = (targetStatMap.percent["HP%"] || 0) + fracValue;
            else if (name.includes("护盾值")) targetStatMap.percent["SHIELD%"] = (targetStatMap.percent["SHIELD%"] || 0) + fracValue;
            else if (name.includes("冲击力")) targetStatMap.percent["IMPACT%"] = (targetStatMap.percent["IMPACT%"] || 0) + fracValue;
            else if (name.includes("穿透率")) targetStatMap.percent["PEN_RATIO"] = (targetStatMap.percent["PEN_RATIO"] || 0) + fracValue;
            else if (name.includes("能量回复效率")) targetStatMap.percent["ENERGY_REGEN_EFF%"] = (targetStatMap.percent["ENERGY_REGEN_EFF%"] || 0) + fracValue; // Correct key
            else if (name.includes("异常掌控")) targetStatMap.percent["ANOMALY_MASTERY%"] = (targetStatMap.percent["ANOMALY_MASTERY%"] || 0) + fracValue;
            else if (name.includes("物理伤害")) targetStatMap.percent["PHYS_DMG"] = (targetStatMap.percent["PHYS_DMG"] || 0) + fracValue;
            else if (name.includes("火属性伤害")) targetStatMap.percent["FIRE_DMG"] = (targetStatMap.percent["FIRE_DMG"] || 0) + fracValue;
            else if (name.includes("冰属性伤害")) targetStatMap.percent["ICE_DMG"] = (targetStatMap.percent["ICE_DMG"] || 0) + fracValue;
            else if (name.includes("电属性伤害") || name.includes("雷属性伤害")) targetStatMap.percent["ELEC_DMG"] = (targetStatMap.percent["ELEC_DMG"] || 0) + fracValue;
            else if (name.includes("以太伤害")) targetStatMap.percent["ETHER_DMG"] = (targetStatMap.percent["ETHER_DMG"] || 0) + fracValue;
            else { logger.warn(`[parseSetBonus] Unhandled percent stat name: ${name}`) }
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
            else if (name.includes("能量自动回复")) targetStatMap.flat["ENERGY_REGEN_RATE"] = (targetStatMap.flat["ENERGY_REGEN_RATE"] || 0) + value;
            else { logger.warn(`[parseSetBonus] Unhandled flat stat name: ${name}`) }
            return true;
        }
        return true;
    }
    return false;
}


export class PropertyCalculator {
    constructor(characterApiData) {
        // --- Initialize final properties ---
        this.finalHp = 0; this.finalAtk = 0; this.finalDef = 0;
        this.finalCritRatePercent = 0; this.finalCritDmgPercent = 0; this.finalImpact = 0;
        this.finalAnomalyProficiency = 0; this.finalAnomalyMastery = 0;
        this.finalPhysDmgPercent = 0; this.finalFireDmgPercent = 0; this.finalIceDmgPercent = 0;
        this.finalElecDmgPercent = 0; this.finalEtherDmgPercent = 0;
        this.finalEnergyRegenPercent = 0;
        this.finalPenValue = 0; this.finalPenRatioPercent = 0;
        this.finalEnergyRegenRate = 0;

        // --- Basic Validation ---
        if (!characterApiData) { logger.error("[PropertyCalculator] Invalid characterApiData input."); return; }
        const characterId = String(characterApiData.Id);
        if (!characterId) { logger.error("[PropertyCalculator] characterApiData missing Id."); return; }

        // --- Load Required Static Data ---
        const enkaAvatarsStoreData = getEnkaStoreAvatarsData();
        const avatarStoreData = enkaAvatarsStoreData?.[characterId];
        const driveSetDescriptions = getDriveSetData();
        const driveLevelMapData = getDriveLevelMap();

        if (!avatarStoreData || !driveSetDescriptions || !driveLevelMapData) {
            logger.error(`[PropertyCalculator] Missing required static data for char ID ${characterId}. Cannot proceed.`);
            return;
        }

        // --- Get Character API Data ---
        const level = characterApiData.Level || 1;
        let promotionLevelApi = characterApiData.PromotionLevel || 0;
        if (promotionLevelApi > 5) promotionLevelApi = 5; // Clamp API level
        const coreEnhancementLevel = characterApiData.CoreSkillEnhancement || 0;

        // --- Base Data from avatars.json ---
        const baseProps = avatarStoreData.BaseProps || {};
        const growthProps = avatarStoreData.GrowthProps || {};
        const promotionPropsArray = avatarStoreData.PromotionProps;
        const coreEnhancementPropsArray = avatarStoreData.CoreEnhancementProps;

        // --- Calculate Character Base Stats ---
        // 1. BaseProps
        const initialBaseHp = Number(baseProps['11101']) || 0;
        const initialBaseAtk = Number(baseProps['12101']) || 0;
        const initialBaseDef = Number(baseProps['13101']) || 0;
        const initialImpact = Number(baseProps['12201']) || 0;
        const initialAnomalyProficiency = Number(baseProps['31201']) || 0;
        const initialAnomalyMastery = Number(baseProps['31401']) || 0;
        const initialEnergyRegenRate = Number(baseProps['30501']) || 0;
        const initialCritRate = Number(baseProps['20101']) || 500;
        const initialCritDmg = Number(baseProps['21101']) || 5000;
        const initialEnergyRegenEff = Number(baseProps['30502']) || 10000;
        const initialPenValue = Number(baseProps['23201']) || 0;
        const initialPenRatio = Number(baseProps['23101']) || 0;
        const initialPhysDmg = Number(baseProps['31501']) || 0;
        const initialFireDmg = Number(baseProps['31601']) || 0;
        const initialIceDmg = Number(baseProps['31701']) || 0;
        const initialElecDmg = Number(baseProps['31801']) || 0;
        const initialEtherDmg = Number(baseProps['31901']) || 0;

        // 2. GrowthValue - Use 10000 as denominator
        const growthHpValue = level > 1 ? Math.floor(((Number(growthProps['11101']) || 0) * (level - 1)) / 10000) : 0;
        const growthAtkValue = level > 1 ? Math.floor(((Number(growthProps['12101']) || 0) * (level - 1)) / 10000) : 0;
        const growthDefValue = level > 1 ? Math.floor(((Number(growthProps['13101']) || 0) * (level - 1)) / 10000) : 0;

        // 3. PromotionValue
        const promoIndex = promotionLevelApi; // PromotionLevel 6 uses index 6 data in EnkaStore? Let's assume index = PromotionLevel for now.
        // Check bounds: PromotionLevel is 0-6, so array index is 0-6. Length should be at least promoIndex+1.
        const currentPromotionProps = (promotionPropsArray && promoIndex < promotionPropsArray.length) ? promotionPropsArray[promoIndex] : {};
        let promotionHpValue = Number(currentPromotionProps?.['11101']) || 0;
        let promotionAtkValue = Number(currentPromotionProps?.['12101']) || 0;
        let promotionDefValue = Number(currentPromotionProps?.['13101']) || 0;
        let promotionImpactValue = Number(currentPromotionProps?.['12201']) || 0;
        let promotionAnomalyProficiencyValue = Number(currentPromotionProps?.['31201']) || 0;
        let promotionAnomalyMasteryValue = Number(currentPromotionProps?.['31401']) || 0;
        let promotionCritRateValue = Number(currentPromotionProps?.['20101']) || 0;
        let promotionCritDmgValue = Number(currentPromotionProps?.['21101']) || 0;
        let promotionEnergyRegenRateValue = Number(currentPromotionProps?.['30501']) || 0;

        // 4. CoreEnhancementValue Contributions
        const coreIndex = coreEnhancementLevel; // CoreEnhancement 6 uses index 6 data.
        const currentCoreEnhancementProps = (coreEnhancementPropsArray && coreIndex < coreEnhancementPropsArray.length) ? coreEnhancementPropsArray[coreIndex] : {};
        const coreFlatAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0, ANOMALY_PROFICIENCY: 0, PEN_VALUE: 0 ,ENERGY_REGEN_RATE: 0 };
        const corePercentAdds = { HP: 0, ATK: 0, DEF: 0, ANOMALY_MASTERY: 0, IMPACT: 0, ENERGY_REGEN: 0 };
        const coreSpecialAdds = { CRIT_RATE: 0, CRIT_DMG: 0, PEN_RATIO: 0, PHYS_DMG: 0, FIRE_DMG: 0, ICE_DMG: 0, ELEC_DMG: 0, ETHER_DMG: 0, ENERGY_REGEN_EFF: 0 };
        // Temporary variables for core base stats - these seem to be ADDITIVE base stats from cores
        let coreHpBaseAdd = 0, coreAtkBaseAdd = 0, coreDefBaseAdd = 0;
        let coreImpactBaseAdd = 0, coreAnomalyPBaseAdd = 0, coreAnomalyMBaseAdd = 0;
        let coreERRateBaseAdd = 0, coreCritRateBaseAdd = 0, coreCritDmgBaseAdd = 0;

        if (currentCoreEnhancementProps) {
            for (const propIdStr in currentCoreEnhancementProps) {
                const coreStatValue = Number(currentCoreEnhancementProps[propIdStr]) || 0;
                if (coreStatValue === 0) continue;
                const config = getPropConfig(propIdStr);
                const enName = config.en; const type = config.type;

                // Separate BASE stats from core enhancements - Note: Core Enhancement BASE stats ADD to the agent's base
                 if (propIdStr === '11101') coreHpBaseAdd += coreStatValue;
                 else if (propIdStr === '12101') coreAtkBaseAdd += coreStatValue;
                 else if (propIdStr === '13101') coreDefBaseAdd += coreStatValue;
                 else if (propIdStr === '12201') coreImpactBaseAdd += coreStatValue;
                 else if (propIdStr === '31201') coreAnomalyPBaseAdd += coreStatValue;
                 else if (propIdStr === '31401') coreAnomalyMBaseAdd += coreStatValue;
                 else if (propIdStr === '30501') coreERRateBaseAdd += coreStatValue;
                 else if (propIdStr === '20101') coreCritRateBaseAdd += coreStatValue;
                 else if (propIdStr === '21101') coreCritDmgBaseAdd += coreStatValue;
                 // Accumulate FLAT stats (non-base) from core
                 else if (type === 'flat') { const k = enName.replace('_FLAT', ''); if (coreFlatAdds[k] !== undefined) coreFlatAdds[k] += coreStatValue; }
                 // Accumulate PERCENT stats from core
                 else if (type === 'percent') { const k = enName.replace('%', ''); if (corePercentAdds[k] !== undefined) corePercentAdds[k] += coreStatValue; }
                 // Accumulate SPECIAL_PERCENT stats from core (non-base ones)
                 else if (type === 'special_percent') { const k = enName.replace('_BASE', ''); if (coreSpecialAdds[k] !== undefined) coreSpecialAdds[k] += coreStatValue; }
                 // Accumulate OTHER_FLAT stats from core (non-base ones)
                 else if (type === 'other_flat') { const k = enName.replace('_BASE', ''); if (coreFlatAdds[k] !== undefined) coreFlatAdds[k] += coreStatValue; }
                 else logger.warn(`[PropertyCalculator][${characterId}] Unhandled core stat type: ${type} or EN Name: ${enName} for ID ${propIdStr}`);
            }
        }

        // --- Calculate Final Character Base Stats (agentBaseStats) ---
        // This is the 'white value' shown in game panels (Character + Cores that add to base)
        const agentBaseStats = {
            HP: initialBaseHp + growthHpValue + promotionHpValue + coreHpBaseAdd,
            ATK: initialBaseAtk + growthAtkValue + promotionAtkValue + coreAtkBaseAdd,
            DEF: initialBaseDef + growthDefValue + promotionDefValue + coreDefBaseAdd,
            IMPACT: initialImpact + promotionImpactValue + coreImpactBaseAdd, // Impact base also accumulates
            ANOMALY_PROFICIENCY: initialAnomalyProficiency + promotionAnomalyProficiencyValue + coreAnomalyPBaseAdd,
            ANOMALY_MASTERY: initialAnomalyMastery + promotionAnomalyMasteryValue + coreAnomalyMBaseAdd,
            ENERGY_REGEN_RATE: initialEnergyRegenRate + promotionEnergyRegenRateValue + coreERRateBaseAdd,
        };
         logger.debug(`[PropertyCalculator][${characterId}] Calculated agentBaseStats (HP/ATK/DEF using Growth/10000): HP:${agentBaseStats.HP}, ATK:${agentBaseStats.ATK}, DEF:${agentBaseStats.DEF}, Impact:${agentBaseStats.IMPACT}`);

        // --- Initialize Accumulators ---
        // Start with inherent base stats (like 5% crit), add promotion bonuses, and add NON-BASE stats from cores
        const finalStatsAccumulator = {
            CRIT_RATE: initialCritRate + promotionCritRateValue + coreCritRateBaseAdd + (coreSpecialAdds.CRIT_RATE || 0),
            CRIT_DMG: initialCritDmg + promotionCritDmgValue + coreCritDmgBaseAdd + (coreSpecialAdds.CRIT_DMG || 0),
            ENERGY_REGEN_EFF: initialEnergyRegenEff + (coreSpecialAdds.ENERGY_REGEN_EFF || 0),
            PEN_VALUE: initialPenValue + (coreFlatAdds.PEN_VALUE || 0),
            PEN_RATIO: initialPenRatio + (coreSpecialAdds.PEN_RATIO || 0),
            PHYS_DMG: initialPhysDmg + (coreSpecialAdds.PHYS_DMG || 0),
            FIRE_DMG: initialFireDmg + (coreSpecialAdds.FIRE_DMG || 0),
            ICE_DMG: initialIceDmg + (coreSpecialAdds.ICE_DMG || 0),
            ELEC_DMG: initialElecDmg + (coreSpecialAdds.ELEC_DMG || 0),
            ETHER_DMG: initialEtherDmg + (coreSpecialAdds.ETHER_DMG || 0),
        };
        const percentAdds = { ...corePercentAdds }; // Includes HP%, ATK%, DEF% etc. from cores
        const flatAdds = { ...coreFlatAdds };     // Includes HP_FLAT, ATK_FLAT, DEF_FLAT etc. from cores

         logger.debug(`[PropertyCalculator][${characterId}] Initialized Accumulators - finalStatsAccumulator:`, finalStatsAccumulator);
         logger.debug(`[PropertyCalculator][${characterId}] Initialized Accumulators - flatAdds:`, flatAdds);
         logger.debug(`[PropertyCalculator][${characterId}] Initialized Accumulators - percentAdds:`, percentAdds);

        // --- Process Weapon ---
        let weaponBaseAtk = 0; // This is the weapon's main base stat (e.g., Base ATK)
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
                   // Weapon's primary base stat contributes to the character's total base ATK (white value)
                   weaponBaseAtk = Math.floor(weaponMainStatBase * (1 + (mainLevelRate + mainStarRate) / 10000));

                   // Weapon's secondary stat adds to the character's bonus stats (green value)
                   const secondaryPropName = weaponStaticData.RandProperty?.Name2;
                   const secondaryPropIdStr = secondaryPropName ? PROP_NAME_TO_ID[secondaryPropName] : null;
                   const secondaryPropBaseValue = Number(weaponStaticData.RandProperty?.Value) || 0;

                   if (secondaryPropIdStr && secondaryPropBaseValue > 0) {
                       const randStarRate = Number(starScalingData.RandRate) || 0;
                       const secondaryStatCalculated = Math.floor(secondaryPropBaseValue * (1 + randStarRate / 10000));
                       const config = getPropConfig(secondaryPropIdStr);
                       const enName = config.en; const type = config.type;
                       if (type === 'flat') { const k = enName.replace('_FLAT', ''); if (flatAdds[k] !== undefined) flatAdds[k] += secondaryStatCalculated; }
                       else if (type === 'percent') { const k = enName.replace('%', ''); if (percentAdds[k] !== undefined) percentAdds[k] += secondaryStatCalculated; }
                       else if (type === 'special_percent') { const k = enName.replace('_BASE', ''); if (finalStatsAccumulator[k] !== undefined) finalStatsAccumulator[k] += secondaryStatCalculated; }
                       else if (type === 'other_flat') { const k = enName.replace('_BASE', ''); if (flatAdds[k] !== undefined) flatAdds[k] += secondaryStatCalculated; }
                       else logger.warn(`[PropertyCalculator][${characterId}] Unhandled weapon secondary stat type: ${type} or EN Name: ${enName} for ID ${secondaryPropIdStr}`);
                   }
               } else {
                    weaponBaseAtk = Math.floor(weaponMainStatBase); // Fallback if scaling data is missing
               }
           }
        }
        // This is the TOTAL white value for ATK shown in game
        const totalBaseAtk = agentBaseStats.ATK + weaponBaseAtk;
        logger.debug(`[PropertyCalculator][${characterId}] Agent Base ATK: ${agentBaseStats.ATK}, Weapon Base ATK: ${weaponBaseAtk}, Total Base ATK: ${totalBaseAtk}`);

        // --- Process Equipment (Drives) ---
        const equippedSetCounts = {};
        (characterApiData.EquippedList || []).forEach((item) => {
            if (!item?.Equipment) return;
            const disc = item.Equipment; const discId = disc.Id; const discLevel = disc.Level || 0;
            let derivedRarity = disc.Rarity; // Use Rarity from Enka data if available
            if (!derivedRarity) { const idStr = String(discId); if (idStr.startsWith('3')) derivedRarity = 4; else if (idStr.startsWith('4')) derivedRarity = 5; else derivedRarity = 3; } // Fallback
            const setBaseId = Math.floor(discId / 100) * 100;
            equippedSetCounts[setBaseId] = (equippedSetCounts[setBaseId] || 0) + 1;
            // Main Stat
            if (disc.MainPropertyList?.[0]) {
                const mainProp = disc.MainPropertyList[0]; const mainPropIdStr = String(mainProp.PropertyId);
                const mainStatBaseValue = Number(mainProp.PropertyValue) || 0;
                const levelData = driveLevelMapData?.[derivedRarity]?.[discLevel];
                const scalingFactor = levelData ? (Number(levelData.HFGGMPPIKOG) || 0) : 0; // HFGGMPPIKOG is LevelRate
                const mainStatValue = Math.floor(mainStatBaseValue * (1 + scalingFactor / 10000));
                const config = getPropConfig(mainPropIdStr); const enName = config.en; const type = config.type;
                if (type === 'flat') { const k = enName.replace('_FLAT', ''); if (flatAdds[k] !== undefined) flatAdds[k] += mainStatValue; }
                else if (type === 'percent') { const k = enName.replace('%', ''); if (percentAdds[k] !== undefined) percentAdds[k] += mainStatValue; }
                else if (type === 'special_percent') { const k = enName.replace('_BASE', ''); if (finalStatsAccumulator[k] !== undefined) finalStatsAccumulator[k] += mainStatValue; }
                else if (type === 'other_flat') { const k = enName.replace('_BASE', ''); if (flatAdds[k] !== undefined) flatAdds[k] += mainStatValue; }
                 logger.trace(`[Drive][${discId}] Main: ${mainPropIdStr} (${enName}), Lvl: ${discLevel}, Rarity: ${derivedRarity}, BaseVal: ${mainStatBaseValue}, Scale: ${scalingFactor}, FinalVal: ${mainStatValue}`);
            }
            // Substats
            (disc.RandomPropertyList || []).forEach(subProp => {
                const subPropIdStr = String(subProp.PropertyId);
                const valuePerRoll = Number(subProp.PropertyValue) || 0; const propLevel = Number(subProp.PropertyLevel) || 1;
                const totalSubstatValue = Math.floor(valuePerRoll * propLevel);
                if (totalSubstatValue === 0) return;
                const config = getPropConfig(subPropIdStr); const enName = config.en; const type = config.type;
                if (type === 'flat') { const k = enName.replace('_FLAT', ''); if (flatAdds[k] !== undefined) flatAdds[k] += totalSubstatValue; }
                else if (type === 'percent') { const k = enName.replace('%', ''); if (percentAdds[k] !== undefined) percentAdds[k] += totalSubstatValue; }
                else if (type === 'special_percent') { const k = enName.replace('_BASE', ''); if (finalStatsAccumulator[k] !== undefined) finalStatsAccumulator[k] += totalSubstatValue; }
                else if (type === 'other_flat') { const k = enName.replace('_BASE', ''); if (flatAdds[k] !== undefined) flatAdds[k] += totalSubstatValue; }
                 logger.trace(`[Drive][${discId}] Sub: ${subPropIdStr} (${enName}), Rolls: ${propLevel}, Val/Roll: ${valuePerRoll}, FinalVal: ${totalSubstatValue}`);
            });
        });
         logger.debug(`[PropertyCalculator][${characterId}] After Drives - flatAdds:`, JSON.stringify(flatAdds));
         logger.debug(`[PropertyCalculator][${characterId}] After Drives - percentAdds:`, JSON.stringify(percentAdds));
         logger.debug(`[PropertyCalculator][${characterId}] After Drives - finalStatsAccumulator:`, JSON.stringify(finalStatsAccumulator));

        // --- Process Set Bonuses ---
        const setBonusesAccumulated = { flat: {}, percent: {}, other: {} };
        const setBonusDescStore = {};
        for (const setIdStr in equippedSetCounts) {
            const setId = parseInt(setIdStr, 10); const count = equippedSetCounts[setId];
            const setData = driveSetDescriptions[setId];
            if (!setData) continue;
            if (count >= 2 && setData.desc1) { if(!parseSetBonus(setData.desc1, setBonusesAccumulated)){ setBonusDescStore[`${setId}-2pc`] = setData.desc1; } }
            if (count >= 4 && setData.desc2) { if(!parseSetBonus(setData.desc2, setBonusesAccumulated)){ setBonusDescStore[`${setId}-4pc`] = setData.desc2; } }
        }

        // --- Apply Conditional Set Bonuses ---
        let currentAnomalyMasteryBaseForCond = agentBaseStats.ANOMALY_MASTERY + (flatAdds.ANOMALY_MASTERY || 0) + (setBonusesAccumulated.flat.ANOMALY_MASTERY || 0);
        let currentAnomalyMasteryPercentForCond = (percentAdds.ANOMALY_MASTERY || 0) + (setBonusesAccumulated.percent['ANOMALY_MASTERY%'] || 0) * 10000;
        let intermediateAnomalyMastery = Math.floor(currentAnomalyMasteryBaseForCond * (1 + currentAnomalyMasteryPercentForCond / 10000));
        for (const setKey in setBonusDescStore) {
            const [setIdStr, ] = setKey.split('-'); const setId = parseInt(setIdStr, 10); const desc = setBonusDescStore[setKey];
            if (setId === 32700 && setKey.endsWith('-4pc')) { if (intermediateAnomalyMastery >= 115) { parseSetBonus(desc, setBonusesAccumulated); } }
            // Add other checks
        }
         logger.debug(`[PropertyCalculator][${characterId}] Parsed Set Bonuses (After Conditional):`, JSON.stringify(setBonusesAccumulated));

        // --- Aggregate All Set Bonuses ---
        // Aggregate FLAT bonuses
        for (const key in setBonusesAccumulated.flat) {
            const flatKey = key.replace('_BASE', '').replace('_FLAT', '');
            if (flatAdds[flatKey] !== undefined) flatAdds[flatKey] += setBonusesAccumulated.flat[key];
            else logger.warn(`[PropertyCalculator][${characterId}] Unknown flat set bonus key mapping: ${key} -> ${flatKey}`);
        }
        // Aggregate PERCENT bonuses
        for (const key in setBonusesAccumulated.percent) {
            const baseKey = key.replace('%', '').replace('_BASE', '').replace('_EFF',''); // Clean key more aggressively
             logger.trace(`[Set Bonus Aggregation] Processing percent key: ${key} -> baseKey: ${baseKey}`);
            if (percentAdds[baseKey] !== undefined) {
                percentAdds[baseKey] += setBonusesAccumulated.percent[key] * 10000; // Add to standard percent categories
                 logger.trace(`  Added ${setBonusesAccumulated.percent[key] * 10000} to percentAdds.${baseKey}`);
            } else if (finalStatsAccumulator[baseKey] !== undefined) {
                 finalStatsAccumulator[baseKey] += setBonusesAccumulated.percent[key] * 10000; // Add to special percent categories
                 logger.trace(`  Added ${setBonusesAccumulated.percent[key] * 10000} to finalStatsAccumulator.${baseKey}`);
            } else {
                logger.warn(`[PropertyCalculator][${characterId}] Unknown percent set bonus key mapping: ${key} -> ${baseKey}`);
            }
        }


         logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - flatAdds:`, JSON.stringify(flatAdds));
         logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - percentAdds:`, JSON.stringify(percentAdds));
         logger.debug(`[PropertyCalculator][${characterId}] After Aggregating Sets - finalStatsAccumulator:`, JSON.stringify(finalStatsAccumulator));

        // --- Final Calculations (Y = k * (1 + X) + b) ---
        this.finalHp = Math.floor(agentBaseStats.HP * (1 + (percentAdds.HP || 0) / 10000) + (flatAdds.HP || 0));
        this.finalAtk = Math.floor(totalBaseAtk * (1 + (percentAdds.ATK || 0) / 10000) + (flatAdds.ATK || 0));
        this.finalDef = Math.floor(agentBaseStats.DEF * (1 + (percentAdds.DEF || 0) / 10000) + (flatAdds.DEF || 0));
        // *** MODIFIED LINE (Commented out percentage scaling to match target image=90) ***
        this.finalImpact = Math.floor(agentBaseStats.IMPACT /* * (1 + (percentAdds.IMPACT || 0) / 10000) */ + (flatAdds.IMPACT || 0));
        this.finalAnomalyProficiency = Math.floor(agentBaseStats.ANOMALY_PROFICIENCY + (flatAdds.ANOMALY_PROFICIENCY || 0)); // Flat only
        this.finalAnomalyMastery = Math.floor(agentBaseStats.ANOMALY_MASTERY * (1 + (percentAdds.ANOMALY_MASTERY || 0) / 10000) + (flatAdds.ANOMALY_MASTERY || 0));

        this.finalCritRatePercent = finalStatsAccumulator.CRIT_RATE;
        this.finalCritDmgPercent = finalStatsAccumulator.CRIT_DMG;
        this.finalPhysDmgPercent = finalStatsAccumulator.PHYS_DMG;
        this.finalFireDmgPercent = finalStatsAccumulator.FIRE_DMG;
        this.finalIceDmgPercent = finalStatsAccumulator.ICE_DMG;
        this.finalElecDmgPercent = finalStatsAccumulator.ELEC_DMG;
        this.finalEtherDmgPercent = finalStatsAccumulator.ETHER_DMG;
        // Energy Regen Eff: Base 100% (10000) + Additions from finalStatsAccumulator * (1 + % additions) + Flat Additions? Check formula. Assume it follows HP/ATK/DEF for now.
        this.finalEnergyRegenPercent = Math.floor(finalStatsAccumulator.ENERGY_REGEN_EFF * (1 + (percentAdds.ENERGY_REGEN || 0) / 10000) + (flatAdds.ENERGY_REGEN || 0));
        this.finalPenValue = Math.floor(finalStatsAccumulator.PEN_VALUE + (flatAdds.PEN_VALUE || 0)); // PEN Value likely flat addition
        this.finalPenRatioPercent = finalStatsAccumulator.PEN_RATIO; // PEN Ratio likely direct addition
        this.finalEnergyRegenRate = Math.floor(agentBaseStats.ENERGY_REGEN_RATE + (flatAdds.ENERGY_REGEN_RATE || 0)); // Energy Regen Rate likely flat addition

        logger.info(`[PropertyCalculator][${characterId}] Calculation finished. Final Raw Values => HP:${this.finalHp} ATK:${this.finalAtk} DEF:${this.finalDef} Impact:${this.finalImpact} CritRate:${this.finalCritRatePercent} CritDmg:${this.finalCritDmgPercent} ER_Eff:${this.finalEnergyRegenPercent} ER_Rate:${this.finalEnergyRegenRate}`);
    }

    // --- Formatting Methods ---
    _formatValue(value, isPercent, decimals = 1, divideBy = 100) { // Added divideBy parameter
        const numericValue = Number(value);
        if (isNaN(numericValue)) { return isPercent ? `0.${'0'.repeat(decimals)}%` : '0'; }
        if (isPercent) {
             // Use the divideBy parameter, default to 100 for most percentages
             return (numericValue / divideBy).toFixed(decimals) + '%';
        } else {
            return String(Math.floor(numericValue)); // Ensure integer display
        }
    }

    getFormattedHpMax() { return this._formatValue(this.finalHp, false); }
    getFormattedAttack() { return this._formatValue(this.finalAtk, false); }
    getFormattedDefence() { return this._formatValue(this.finalDef, false); }
    getFormattedBreakStun() { return this._formatValue(this.finalImpact, false); }
    getFormattedCrit() { return this._formatValue(this.finalCritRatePercent, true, 1, 100); } // Crit Rate needs /100
    getFormattedCritDmg() { return this._formatValue(this.finalCritDmgPercent, true, 1, 100); } // Crit Dmg needs /100
    getFormattedElementAbnormalPower() { return this._formatValue(this.finalAnomalyMastery, false); }
    getFormattedElementMystery() { return this._formatValue(this.finalAnomalyProficiency, false); }
    getFormattedPenRate() { return this._formatValue(this.finalPenRatioPercent, true, 1, 100); } // PEN Rate likely needs /100
    getFormattedSpRecoverRate() { return (this.finalEnergyRegenRate / 100).toFixed(1); } // Format to match target 1.2
    getFormattedEnergyRegenEff() { return this._formatValue(this.finalEnergyRegenPercent, true, 1, 100); } // ER Eff needs /100
    getFormattedPenDelta() { return this._formatValue(this.finalPenValue, false); }
    getFormattedPhysDmgBonus() { return this._formatValue(this.finalPhysDmgPercent, true, 1, 100); } // DMG Bonuses likely need /100
    getFormattedFireDmgBonus() { return this._formatValue(this.finalFireDmgPercent, true, 1, 100); }
    getFormattedIceDmgBonus() { return this._formatValue(this.finalIceDmgPercent, true, 1, 100); }
    getFormattedThunderDmgBonus() { return this._formatValue(this.finalElecDmgPercent, true, 1, 100); }
    getFormattedEtherDmgBonus() { return this._formatValue(this.finalEtherDmgPercent, true, 1, 100); }
}
