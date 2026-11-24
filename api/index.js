import { handleRequest } from '../index.js';

export const config = {
  runtime: 'edge',
  regions: ['bom1']
};

export default async function handler(request) {
  return handleRequest(request);
}
