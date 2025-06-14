// DataGenerator.js
import _ from 'lodash';
import { getZzzEnkaData } from './lib/enka/query.js'; // 确认路径正确
import { _enka_data_to_mys_data } from './lib/enka/enka_to_mys.js'; // 确认路径正确

const CACHE_TTL_MS = 5 * 60 * 1000; // 缓存 5 分钟，根据需要调整

class DataGenerator {
    constructor() {
        // 使用 Map 存储缓存，键是 uid，值是 { timestamp: Date.now(), data: mysFormattedData }
        this.cache = new Map();
    }

    // 检查缓存是否有效
    _isCacheValid(uid) {
        if (!this.cache.has(uid)) {
            return false;
        }
        const cachedEntry = this.cache.get(uid);
        return (Date.now() - cachedEntry.timestamp) < CACHE_TTL_MS;
    }

    // 清除指定 UID 的缓存
    clearCache(uid) {
        this.cache.delete(uid);
        logger.info(`[DataGenerator] Cleared cache for UID: ${uid}`);
    }

    // 核心方法：获取并转换数据，使用缓存
    async getMysFormattedData(uid, forceRefresh = false) {
        if (!uid) {
            logger.error('[DataGenerator] UID is required.');
            return { error: 'UID is required', retcode: -400 };
        }

        const cacheKey = String(uid);

        // 如果不强制刷新且缓存有效，直接返回缓存数据
        if (!forceRefresh && this._isCacheValid(cacheKey)) {
            logger.info(`[DataGenerator] Returning cached data for UID: ${uid}`);
            return this.cache.get(cacheKey).data; // 返回缓存的 mys 格式数据数组
        }

        logger.info(`[DataGenerator] ${forceRefresh ? 'Force refreshing' : 'Fetching new'} data for UID: ${uid}`);

        try {
            // 1. 获取 Enka 数据
            const enkaData = await getZzzEnkaData(uid);

            // 处理 Enka API 可能返回的错误状态码或非 JSON 数据
            if (typeof enkaData === 'number') {
                logger.error(`[DataGenerator] Enka API returned status code: ${enkaData} for UID: ${uid}`);
                 // 根据需要返回更具体的错误码和消息
                 let message = `Failed to fetch Enka data (status: ${enkaData})`;
                 if (enkaData === 404) message = 'Player does not exist or has not enabled showcase';
                 if (enkaData === 400) message = 'Invalid UID format';
                 if (enkaData === 429) message = 'Enka rate limited';
                 if (enkaData === 424) message = 'Game maintenance or invalid game account state';
                return { error: message, retcode: -500, status: enkaData }; // 返回错误对象
            }
            if (!enkaData || typeof enkaData !== 'object') {
                 logger.error(`[DataGenerator] Invalid Enka data received for UID: ${uid}`, enkaData);
                return { error: 'Invalid data from Enka API', retcode: -501 };
            }
             // 检查是否有必要信息，例如 ShowcaseDetail
             if (!enkaData?.PlayerInfo?.ShowcaseDetail) {
                 logger.warn(`[DataGenerator] Enka data for UID ${uid} lacks ShowcaseDetail. Maybe showcase is disabled?`);
                 // 根据 Enka 实际返回判断是否算错误
                 if (enkaData?.PlayerInfo?.Nickname) { // 如果有昵称但没展柜，可能只是没开
                     return { error: 'Player showcase might be disabled', retcode: -4041, nickname: enkaData.PlayerInfo.Nickname };
                 }
                 return { error: 'Incomplete data from Enka API (Missing ShowcaseDetail)', retcode: -502 };
             }


            // 2. 转换数据为米游社格式
            // _enka_data_to_mys_data 期望 enka_data 作为输入
            const mysFormattedData = await _enka_data_to_mys_data(enkaData); // 注意这里的 await

            if (!Array.isArray(mysFormattedData)) {
                logger.error(`[DataGenerator] Conversion to MYS format failed for UID: ${uid}`);
                return { error: 'Data conversion failed', retcode: -503 };
            }

            // 3. 更新缓存
            this.cache.set(cacheKey, {
                timestamp: Date.now(),
                data: mysFormattedData // 缓存转换后的 MYS 格式数组
            });
            logger.info(`[DataGenerator] Successfully fetched, converted, and cached data for UID: ${uid}`);

            return mysFormattedData; // 返回 MYS 格式数据数组

        } catch (error) {
            logger.error(`[DataGenerator] Error processing data for UID ${uid}:`, error);
            return { error: `Internal generator error: ${error.message}`, retcode: -500 };
        }
    }
}

export default DataGenerator;
