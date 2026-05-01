import { v4 as uuidv4 } from 'uuid';
import type { Extractor } from '../types';

export const generateId = () => uuidv4();

export const createEmptyExtractor = (): Extractor => ({
  id: generateId(),
  alias: '',
  selector: '',
  type: 'text',
});

export const createIndexExtractor = (): Extractor => ({
  id: generateId(),
  alias: 'index',
  selector: '.',
  type: 'index',
});
