import http from 'http';
import https from 'https';
import axios from 'axios';

export const axiosDefaultParams = {
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 5e3
};

export async function fetchHttpImage(url: string): Promise<Buffer> {
  return (
    await axios({
      url,
      ...{
        responseType: 'arraybuffer',
        ...axiosDefaultParams
      }
    })
  ).data;
}
