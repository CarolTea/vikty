import { Ajv, type Options } from 'ajv';
import addFormats from 'ajv-formats';
import type { FastifySchemaCompiler } from 'fastify';

const base: Options = { allErrors: true, removeAdditional: true, useDefaults: true };

// Bodies are JSON and must match the contract exactly: a number never becomes a string
// (money travels as decimal strings, never floats).
const bodyAjv = addFormats.default(new Ajv({ ...base, coerceTypes: false }));

// Query strings and path params always arrive as text, so "20" may become 20 there.
const urlAjv = addFormats.default(new Ajv({ ...base, coerceTypes: 'array' }));

export const validatorCompiler: FastifySchemaCompiler<object> = ({ schema, httpPart }) =>
  (httpPart === 'body' ? bodyAjv : urlAjv).compile(schema);
