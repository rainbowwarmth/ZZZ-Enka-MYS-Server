// enka_to_mys.js (Final Refactored - Stitching Focus)

import _ from 'lodash';

// --- Import Core Modules ---
import {
    getHakushCharacterData,
    getHakushWeaponData,
    getHakushEquipmentData,
} from './data_loader.js'; // Adjust path
import {
    ID_TO_PROP_NAME,
    HAKUSH_RARITY_MAP,
} from './constants.js'; // Adjust path
import {
    constructIconUrlFromHakushPath,
    getCharCircleIconUrlFromOldAvatars,
    getCharBaseIconUrlFromOldAvatars,
    DEFAULT_CIRCLE_ICON_URL,
    DEFAULT_BASE_ICON_URL,
    DEFAULT_WEAPON_ICON_URL,
    DEFAULT_DRIVE_ICON_URL
} from './url_builder.js'; // Adjust path
import { getCharacterBasicInfo } from './character_calculator.js'; // Adjust path
import { renderWeaponDetailForDisplay } from './weapon_calculator.js'; // Adjust path
import {
    calculateDriveMainStatValueForDisplay,
    calculateDriveSubStatValueForDisplay
} from './drive_calculator.js'; // Adjust path
import { formatStatValueForDisplay } from './value_formatter.js'; // Adjust path
import { processSkills } from './skill_processor.js'; // Adjust path
import { processRanks } from './rank_processor.js'; // Adjust path
import { PropertyCalculator } from './property_calculator.js'; // Adjust path

import { logger } from '../logger.js'; // Adjust path

// --- Main Conversion Function ---
export async function _enka_data_to_mys_data(enka_data) {
    if (!enka_data?.PlayerInfo?.ShowcaseDetail?.AvatarList || !Array.isArray(enka_data.PlayerInfo.ShowcaseDetail.AvatarList)) {
        logger.error("[enka_to_mys.js] Invalid or empty AvatarList in Enka data.");
        return [];
    }

    const uid = enka_data.uid;
    const result_list = [];
    const hakushEquipmentData = getHakushEquipmentData(); // Load once

    for (const char of enka_data.PlayerInfo.ShowcaseDetail.AvatarList) {
        try {
            if (!char || typeof char.Id === 'undefined') {
                logger.warn("[enka_to_mys.js] Skipping invalid character entry in AvatarList.");
                continue;
            }

            const char_id = String(char.Id);
            logger.info(`[enka_to_mys.js] Processing character ID: ${char_id}`);

            // --- Get Base Data ---
            const basicInfo = getCharacterBasicInfo(char_id);
            const hakushCharData = getHakushCharacterData(char_id); // Renamed for clarity

            if (!basicInfo || !hakushCharData) {
                logger.warn(`[enka_to_mys.js] Skipping char ID ${char_id}: Missing basic info or detailed Hakush data.`);
                continue;
            }

            const enkaLevel = char.Level || 1;
            const enkaPromotionLevel = char.PromotionLevel || 0;
            const enkaRankLevel = char.TalentLevel || 0; // Renamed for clarity

            // --- Stitch Base Character Structure ---
            const finalCharDataForModel = {
                id: char.Id,
                level: enkaLevel,
                name_mi18n: basicInfo.name,
                full_name_mi18n: basicInfo.full_name,
                element_type: basicInfo.element_type,
                sub_element_type: 0,
                camp_name_mi18n: basicInfo.camp_name_mi18n,
                avatar_profession: basicInfo.avatar_profession,
                rarity: basicInfo.rarity,
                group_icon_path: getCharCircleIconUrlFromOldAvatars(char_id) || DEFAULT_CIRCLE_ICON_URL,
                hollow_icon_path: getCharCircleIconUrlFromOldAvatars(char_id) || DEFAULT_CIRCLE_ICON_URL,
                role_square_url: getCharBaseIconUrlFromOldAvatars(char_id) || DEFAULT_BASE_ICON_URL,
                role_vertical_painting_url: getCharBaseIconUrlFromOldAvatars(char_id) || DEFAULT_BASE_ICON_URL, // Placeholder
                square_icon: getCharBaseIconUrlFromOldAvatars(char_id) || DEFAULT_BASE_ICON_URL,
                equip: [],
                weapon: null,
                properties: [],
                skills: [],
                rank: enkaRankLevel, // Use the level here
                ranks: [], // This will be the detailed list
                isNew: undefined
            };

            // --- Stitch Weapon Section ---
            if (char.Weapon?.Id) {
                const weapon_id = String(char.Weapon.Id);
                const hakushWeaponData = getHakushWeaponData(weapon_id);

                if (hakushWeaponData) {
                    const weapon_level = char.Weapon.Level || 1;
                    const weapon_star_display = (char.Weapon.UpgradeLevel || 0) + 1;
                    const weapon_break_level = char.Weapon.BreakLevel || 0;

                    const { baseValue, randValue, basePropId, randPropId } = renderWeaponDetailForDisplay(
                        weapon_id, weapon_level, weapon_break_level
                    );
                    const weaponIconUrl = constructIconUrlFromHakushPath(hakushWeaponData.Icon) || DEFAULT_WEAPON_ICON_URL;

                    finalCharDataForModel.weapon = {
                        id: char.Weapon.Id, level: weapon_level, name: hakushWeaponData.Name || `武器 ${weapon_id}`,
                        star: weapon_star_display, icon: weaponIconUrl, rarity: HAKUSH_RARITY_MAP[hakushWeaponData.Rarity] || 'B',
                        properties: [], main_properties: [],
                        talent_title: _.get(hakushWeaponData, ['Talents', String(weapon_star_display), 'Name'], ''),
                        talent_content: _.get(hakushWeaponData, ['Talents', String(weapon_star_display), 'Desc'], ''),
                        profession: basicInfo.avatar_profession,
                     };
                     if (basePropId) {
                        finalCharDataForModel.weapon.main_properties.push({
                            property_name: ID_TO_PROP_NAME[basePropId] || `?(${basePropId})`, property_id: basePropId,
                            base: formatStatValueForDisplay(baseValue, basePropId)
                        });
                     }
                     if (randPropId && randValue > 0) {
                         finalCharDataForModel.weapon.properties.push({
                             property_name: ID_TO_PROP_NAME[randPropId] || `?(${randPropId})`, property_id: randPropId,
                             base: formatStatValueForDisplay(randValue, randPropId)
                         });
                     }
                } else { logger.warn(`[enka_to_mys.js] Weapon Hakush data missing for ID: ${weapon_id}`); }
            }

            // --- Stitch Equipment Section ---
            const equipDisplayList = [];
            const suitCounts = {};
            if (char.EquippedList && Array.isArray(char.EquippedList)) {
                for (const relic of char.EquippedList) {
                     if (!relic?.Equipment) continue;
                     const _equip = relic.Equipment;
                     const equip_id_str = String(_equip.Id);
                     const suit_id_str = equip_id_str.length >= 5 ? equip_id_str.slice(0, 3) + '00' : null;
                     if (!suit_id_str) continue;

                     const equip_meta = hakushEquipmentData[suit_id_str];
                     const suit_name = equip_meta?.CHS?.name || `套装 ${suit_id_str}`;
                     const equipIconUrl = constructIconUrlFromHakushPath(equip_meta?.icon) || DEFAULT_DRIVE_ICON_URL;
                     const relic_level = _equip.Level || 0;
                     const display_rarity = _equip.Rarity ? (_equip.Rarity == 5 ? 'S' : 'A') : 'A';
                     suitCounts[suit_id_str] = (suitCounts[suit_id_str] || 0) + 1;

                     const raw_equip_obj = {
                         id: _equip.Id, level: relic_level, name: `${suit_name}[${relic.Slot}]`,
                         icon: equipIconUrl, rarity: display_rarity, properties: [], main_properties: [],
                         equip_suit: { suit_id: parseInt(suit_id_str, 10), name: suit_name, own: 0, desc1: equip_meta?.CHS?.desc2 || "", desc2: equip_meta?.CHS?.desc4 || "" },
                         equipment_type: relic.Slot
                     };
                     if (_equip.MainPropertyList?.[0]) {
                         const main_prop_enka = _equip.MainPropertyList[0];
                         const rawValue = calculateDriveMainStatValueForDisplay(main_prop_enka, relic_level);
                         raw_equip_obj.main_properties.push({
                             property_name: ID_TO_PROP_NAME[main_prop_enka.PropertyId] || `?(${main_prop_enka.PropertyId})`,
                             property_id: main_prop_enka.PropertyId,
                             base: formatStatValueForDisplay(rawValue, main_prop_enka.PropertyId)
                         });
                     }
                     if (_equip.RandomPropertyList) {
                         for (const sub_prop_enka of _equip.RandomPropertyList) {
                             if (!sub_prop_enka || sub_prop_enka.PropertyId === undefined) continue;
                             const rawValue = calculateDriveSubStatValueForDisplay(sub_prop_enka);
                             raw_equip_obj.properties.push({
                                 property_name: ID_TO_PROP_NAME[sub_prop_enka.PropertyId] || `?(${sub_prop_enka.PropertyId})`,
                                 property_id: sub_prop_enka.PropertyId,
                                 base: formatStatValueForDisplay(rawValue, sub_prop_enka.PropertyId)
                             });
                         }
                     }
                     equipDisplayList.push(raw_equip_obj);
                }
                equipDisplayList.forEach(eq => { eq.equip_suit.own = suitCounts[String(eq.equip_suit.suit_id)] || 0; });
                finalCharDataForModel.equip = equipDisplayList;
            }

            // --- Stitch Final Panel Properties ---
            const propertiesGetter = new PropertyCalculator(char); // Instantiate calculator
            const finalPropertiesArray = [];
            const addedMysIds = new Set();
            const MYS_PANEL_CONFIG = { /* ... same config as before ... */
                 HpMax: { zh: '生命值', mysId: 1, getter: 'getFormattedHpMax' },
                 Attack: { zh: '攻击力', mysId: 2, getter: 'getFormattedAttack' },
                 Defence: { zh: '防御力', mysId: 3, getter: 'getFormattedDefence' },
                 BreakStun: { zh: '冲击力', mysId: 4, getter: 'getFormattedBreakStun' },
                 Crit: { zh: '暴击率', mysId: 5, getter: 'getFormattedCrit' },
                 CritDmg: { zh: '暴击伤害', mysId: 6, getter: 'getFormattedCritDmg' },
                 ElementAbnormalPower: { zh: '异常掌控', mysId: 7, getter: 'getFormattedElementAbnormalPower' },
                 ElementMystery: { zh: '异常精通', mysId: 8, getter: 'getFormattedElementMystery' },
                 PenRate: { zh: '穿透率', mysId: 9, getter: 'getFormattedPenRate' },
                 SpRecoverPercent: { zh: '能量自动回复', mysId: 11, getter: 'getFormattedSpRecoverRate' },
                 PenDelta: { zh: '穿透值', mysId: 232, getter: 'getFormattedPenDelta' },
                 PhysDmgBonus: { zh: '物理伤害加成', mysId: 315, getter: 'getFormattedPhysDmgBonus' },
                 FireDmgBonus: { zh: '火属性伤害加成', mysId: 316, getter: 'getFormattedFireDmgBonus' },
                 IceDmgBonus: { zh: '冰属性伤害加成', mysId: 317, getter: 'getFormattedIceDmgBonus' },
                 ThunderDmgBonus: { zh: '雷属性伤害加成', mysId: 318, getter: 'getFormattedThunderDmgBonus' },
                 EtherDmgBonus: { zh: '以太属性伤害加成', mysId: 319, getter: 'getFormattedEtherDmgBonus' },
            };
            for (const [/*propKey*/, config] of Object.entries(MYS_PANEL_CONFIG)) { // propKey no longer needed
                 if (typeof propertiesGetter[config.getter] === 'function') {
                     const finalValueStr = propertiesGetter[config.getter]();
                     if (finalValueStr !== undefined && finalValueStr !== null && !addedMysIds.has(config.mysId)) {
                         finalPropertiesArray.push({
                             property_name: config.zh, property_id: config.mysId, base: "", add: "", final: finalValueStr
                         });
                         addedMysIds.add(config.mysId);
                     }
                 } else { logger.warn(`[enka_to_mys] Getter function ${config.getter} not found on PropertyCalculator.`); }
            }
            // Sort
            finalPropertiesArray.sort((a, b) => { /* ... same sort logic ... */
                 const order = [1, 2, 3, 5, 6, 11, 4, 8, 7, 9, 232, 315, 316, 317, 318, 319];
                 const indexA = order.indexOf(a.property_id); const indexB = order.indexOf(b.property_id);
                 if (indexA === -1 && indexB === -1) return a.property_id - b.property_id;
                 if (indexA === -1) return 1; if (indexB === -1) return -1; return indexA - indexB;
             });
            finalCharDataForModel.properties = finalPropertiesArray;

            // --- Stitch Skills Section ---
            const enkaSkillLevels = Object.fromEntries((char.SkillLevelList || []).map(s => [String(s.Index ?? s.Id), s.Level]));
            finalCharDataForModel.skills = processSkills(hakushCharData, enkaSkillLevels, char_id); // Use skill_processor

            // --- Stitch Ranks Section ---
            finalCharDataForModel.ranks = processRanks(hakushCharData, enkaRankLevel); // Use rank_processor

            // --- Final Push ---
            result_list.push(finalCharDataForModel);

        } catch (processingError) {
            logger.error(`[enka_to_mys.js] CRITICAL ERROR processing character ID ${char?.Id || 'Unknown'}:`, processingError);
        }
    } // End of character loop

    logger.info(`[enka_to_mys.js] Enka data conversion finished. Processed ${result_list.length} characters for UID ${uid}.`);
    return result_list;
}
