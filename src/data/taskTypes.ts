import type { TaskType } from '../types/analysis'

export interface TaskTypeOption {
  id: TaskType
  label: string
  description: string
}

export const TASK_TYPES: readonly TaskTypeOption[] = [
  {
    id: 'training',
    label: 'Training',
    description: 'Training a model from scratch. Sustained, near-maximum GPU load.',
  },
  {
    id: 'fine-tuning',
    label: 'Fine-tuning',
    description: 'Adapting a pre-trained model. Shorter runs with high but variable load.',
  },
  {
    id: 'inference',
    label: 'Inference',
    description: 'Serving a trained model. Lower, spiky load that follows demand.',
  },
]
