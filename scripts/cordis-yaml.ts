/**
 * Cordis YAML parsing and Loader-entry classification shared by repository checks.
 * @module scripts/cordis-yaml
 */

import * as yaml from 'js-yaml'
import { defineScalarTag, NOT_RESOLVED } from 'js-yaml'

/** A Loader `!!js` expression preserved as data instead of executed. */
export interface JsExpr {
  __jsExpr: string
}

// js-yaml 5 custom scalar: `resolve` both gates and constructs, `identify` replaces the v4 predicate.
const jsExprType = defineScalarTag('tag:yaml.org,2002:js', {
  resolve: (data: string): JsExpr | typeof NOT_RESOLVED => {
    if (typeof data !== 'string') throw new TypeError('!!js requires a scalar string')
    if (data === '') return NOT_RESOLVED
    return { __jsExpr: data }
  },
  identify: (data: unknown): data is JsExpr =>
    typeof data === 'object' && data !== null && '__jsExpr' in data && typeof (data as JsExpr).__jsExpr === 'string',
  represent: (data: JsExpr): string => data['__jsExpr'],
})
const schema = yaml.JSON_SCHEMA.withTags(jsExprType)

/**
 * Parse a Cordis config while preserving Loader `!!js` expressions as data.
 * @param source - Cordis YAML source text.
 * @returns the parsed YAML value.
 */
export function loadCordisYaml(source: string): unknown {
  return yaml.load(source, { schema })
}

/**
 * Test whether a value is a preserved Loader `!!js` expression.
 * @param value - parsed YAML value.
 * @returns whether the value contains one preserved expression.
 */
export function isJsExpr(value: unknown): value is JsExpr {
  return typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).__jsExpr === 'string'
}

/**
 * Test whether a Loader entry owns nested entries in its `config` array.
 * @param value - parsed Loader entry.
 * @returns whether the entry is an explicit or package-named Cordis group.
 */
export function isCordisGroupEntry(value: unknown): value is Record<string, unknown> & { config: unknown[] } {
  return typeof value === 'object'
    && value !== null
    && Array.isArray((value as Record<string, unknown>).config)
    && ((value as Record<string, unknown>).group === true
      || (value as Record<string, unknown>).name === '@deepseek-ai/cordis-plugin-group')
}
