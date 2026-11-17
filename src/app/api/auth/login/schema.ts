import { z } from 'zod';

export const loginRequestSchema = z
  .object({
    username: z.string().meta({ description: 'Formami username.' }),
    password: z.string().meta({ description: 'Formami password.' }),
  })
  .meta({ id: 'LoginRequest' });
