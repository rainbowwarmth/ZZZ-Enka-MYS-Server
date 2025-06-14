
import { ENKA_API } from './api.js'
import _ from 'lodash'
import fetch from 'node-fetch'

const useEnka = true
export async function getZzzEnkaData(uid) {
  if (useEnka) {
    try {
      const response = await fetch(ENKA_API.replace('{uid}', uid),
        {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': 'https://enka.network/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
      }
      );

      if (!response.ok) {
        logger.error(`HTTP 错误! 状态码: ${response.status}`);
        return response.status;
      }

      const data = await response.json(); // 解析 JSON 响应
      if (typeof data === 'number') {
        return data;
      }
      return data;

    } catch (error) {
      logger.error("Error fetching ZZZ Enka data:", error);
      return -1;
    }
  }

  return null;
}
